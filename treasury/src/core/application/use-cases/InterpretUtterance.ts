import { getScenario } from "../../domain/scenarios/Scenario";
import type { SlotDefinition } from "../../domain/value-objects/Slot";
import type { DialogState, SlotValidationError } from "../../domain/services/DialogEngine";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";
import type { SlotExtractionPort, SlotProposal } from "../ports/SlotExtractionPort";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";

export interface InterpretUtteranceInput {
  intentId: string;
  utterance: string;
}

export interface InterpretUtteranceResult {
  intentId: string;
  state: DialogState;
  /** Keys that were extracted with enough confidence and successfully recorded. */
  accepted: string[];
  /** Proposals that failed validation (or named an unknown slot) — never recorded. */
  rejected: SlotValidationError[];
  /** Keys skipped because the slot was already filled (fill-only overwrite policy). */
  skipped: string[];
  /** Proposals below the confidence threshold — not applied; surfaced for a later confirm step. */
  lowConfidence: SlotProposal[];
}

export interface InterpretOptions {
  /** Proposals at or above this confidence are applied; below it they are held back. Default 0.5. */
  confidenceThreshold?: number;
}

/**
 * The natural-language entry point — the analog of AdvanceDialog for free text. It asks the
 * SlotExtractionPort (the only non-deterministic step) for value PROPOSALS, then funnels the
 * confident ones through the deterministic ApplyAnswers merge in `fill` mode. Extraction never
 * advances state by itself: the state moves only through ApplyAnswers + DialogEngine. Low-confidence
 * proposals are held back (not silently accepted), and a failing port degrades to simply asking the
 * current question — the flow never breaks.
 *
 * Phase 2: the scenario is already bound to the intent. Classifying a scenario from the first
 * utterance is a later phase and will extend this use case without altering the merge path.
 */
export class InterpretUtteranceUseCase {
  private readonly threshold: number;

  constructor(
    private readonly repo: IntentRepository,
    private readonly extractor: SlotExtractionPort,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
    options: InterpretOptions = {},
  ) {
    this.threshold = options.confidenceThreshold ?? 0.5;
  }

  async execute(input: InterpretUtteranceInput): Promise<InterpretUtteranceResult> {
    const intent = await this.repo.findById(input.intentId);
    if (!intent) throw new Error(`Unknown intent: ${input.intentId}`);

    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    const now = this.clock.now();
    await this.audit.record({ intentId: intent.id, at: now, type: "utterance.received", detail: input.utterance });

    const proposals = await this.safeExtract(input.utterance, scenario.slots, intent.answers, intent.id);

    const confident = proposals.filter((p) => p.confidence >= this.threshold);
    const lowConfidence = proposals.filter((p) => p.confidence < this.threshold);

    // Confident proposals fill empty slots only; prior answers are never overwritten by extraction.
    const applied = await this.applyAnswers.execute({
      intentId: intent.id,
      answers: confident.map((p) => ({ key: p.key, value: p.value })),
      mode: "fill",
    });

    const rejectedKeys = new Set(applied.rejected.map((r) => r.key));
    const skippedKeys = new Set(applied.skipped);
    const accepted = confident
      .map((p) => p.key)
      .filter((k) => !rejectedKeys.has(k) && !skippedKeys.has(k));

    return {
      intentId: intent.id,
      state: applied.state,
      accepted,
      rejected: applied.rejected,
      skipped: applied.skipped,
      lowConfidence,
    };
  }

  /** Extraction must never break the conversation: on any failure, propose nothing. */
  private async safeExtract(
    utterance: string,
    slots: SlotDefinition[],
    priorAnswers: Record<string, string>,
    intentId: string,
  ): Promise<SlotProposal[]> {
    try {
      const result = await this.extractor.extract({ utterance, slots, priorAnswers });
      return result.slots;
    } catch (err) {
      await this.audit.record({
        intentId,
        at: this.clock.now(),
        type: "extraction.failed",
        detail: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
