import { Intent } from "../../domain/entities/Intent";
import { getScenario, listScenarios } from "../../domain/scenarios/Scenario";
import type { DialogState, SlotValidationError } from "../../domain/services/DialogEngine";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import type {
  ScenarioCatalogEntry,
  SlotExtractionPort,
  SlotExtractionRequest,
  SlotExtractionResult,
  SlotProposal,
} from "../ports/SlotExtractionPort";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { IdentityOutcome } from "../services/IdentitySlotResolution";

export interface InterpretUtteranceInput {
  /** Present to continue an existing intent (bound mode). Absent to start from the first utterance. */
  intentId?: string;
  utterance: string;
  /** Required when there is no intentId yet — the intent is created for this user. */
  userId?: string;
}

export interface InterpretUtteranceResult {
  /** Present once an intent exists (continued, or created after classification). */
  intentId?: string;
  /** The scenario in play (bound, or the one classified from the utterance). */
  scenarioId?: string;
  /** The next dialog state — present whenever an intent exists. */
  state?: DialogState;
  /** A question to resolve which operation the user means — present when no scenario was resolved. */
  clarification?: string;
  /** Keys that were extracted with enough confidence and successfully recorded. */
  accepted: string[];
  /** Proposals that failed validation (or named an unknown slot) — never recorded. */
  rejected: SlotValidationError[];
  /** Keys skipped because the slot was already filled (fill-only overwrite policy). */
  skipped: string[];
  /** Proposals below the confidence threshold — not applied; surfaced for a later confirm step. */
  lowConfidence: SlotProposal[];
  /** How each proposed PARTY mention resolved. An unresolved one is not recorded. */
  identity: IdentityOutcome[];
}

export interface InterpretOptions {
  /** Proposals at or above this confidence are applied; below it they are held back. Default 0.5. */
  confidenceThreshold?: number;
}

/** The merge-outcome fields when nothing was proposed (e.g. a clarification turn). */
function emptyOutcome(): Pick<
  InterpretUtteranceResult,
  "accepted" | "rejected" | "skipped" | "lowConfidence" | "identity"
> {
  return { accepted: [], rejected: [], skipped: [], lowConfidence: [], identity: [] };
}

/**
 * The natural-language entry point — the analog of AdvanceDialog for free text. It asks the
 * SlotExtractionPort (the only non-deterministic step) for value PROPOSALS, then funnels the
 * confident ones through the deterministic ApplyAnswers merge in `fill` mode. Extraction never
 * advances state by itself: state moves only through ApplyAnswers + DialogEngine. Low-confidence
 * proposals are held back (not silently accepted), and a failing port degrades gracefully.
 *
 * Two entry points share one merge path:
 *  - bound mode (intentId given): extract for the intent's scenario and merge;
 *  - classify mode (no intentId): classify a scenario from the catalog, create the intent, then merge.
 * When the scenario cannot be confidently classified — or the guess is not a real scenario — nothing
 * is created and a clarification is returned (no CLARIFYING status; it is purely a turn output).
 */
export class InterpretUtteranceUseCase {
  private readonly threshold: number;

  constructor(
    private readonly repo: IntentRepository,
    private readonly extractor: SlotExtractionPort,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly directory: PartyDirectoryPort,
    options: InterpretOptions = {},
  ) {
    this.threshold = options.confidenceThreshold ?? 0.5;
  }

  async execute(input: InterpretUtteranceInput): Promise<InterpretUtteranceResult> {
    return input.intentId ? this.interpretBound(input.intentId, input.utterance) : this.interpretNew(input);
  }

  /** Continue an existing intent: extract for its scenario's slots and merge. */
  private async interpretBound(intentId: string, utterance: string): Promise<InterpretUtteranceResult> {
    const intent = await this.repo.findById(intentId);
    if (!intent) throw new Error(`Unknown intent: ${intentId}`);
    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    await this.audit.record({ intentId, at: this.clock.now(), type: "utterance.received", detail: utterance });

    const result = await this.safeExtract(
      {
        utterance,
        slots: scenario.slots,
        priorAnswers: intent.answers,
        knownParties: await this.knownParties(),
      },
      intentId,
    );
    const merged = await this.mergeProposals(intentId, result.slots);
    return { intentId, scenarioId: scenario.id, ...merged };
  }

  /** Start from the first utterance: classify a scenario, create the intent, then merge. */
  private async interpretNew(input: InterpretUtteranceInput): Promise<InterpretUtteranceResult> {
    if (!input.userId) throw new Error("userId is required to start an intent from an utterance.");

    const catalog: ScenarioCatalogEntry[] = listScenarios().map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      slots: s.slots,
      // Union of every locale's keywords — makes the deterministic classifier multilingual without
      // changing its algorithm (it just has more, language-specific tokens to match against).
      keywords: Object.values(s.keywords ?? {}).flat(),
    }));

    const result = await this.safeExtract({
      utterance: input.utterance,
      scenarios: catalog,
      knownParties: await this.knownParties(),
    });

    // No confident, real scenario → ask which operation. Nothing is created.
    const scenario = result.scenarioId ? getScenario(result.scenarioId) : undefined;
    if (!scenario) {
      return { clarification: result.clarification ?? this.defaultClarification(catalog), ...emptyOutcome() };
    }

    const now = this.clock.now();
    const intent = Intent.start(this.ids.next(), scenario.id, input.userId, now);
    await this.repo.save(intent);
    await this.audit.record({ intentId: intent.id, at: now, type: "intent.started", detail: scenario.id });
    await this.audit.record({ intentId: intent.id, at: now, type: "utterance.received", detail: input.utterance });

    const merged = await this.mergeProposals(intent.id, result.slots);
    return { intentId: intent.id, scenarioId: scenario.id, ...merged };
  }

  /** Confidence split → deterministic ApplyAnswers merge (fill mode). The one shared merge path. */
  private async mergeProposals(intentId: string, proposals: SlotProposal[]) {
    const confident = proposals.filter((p) => p.confidence >= this.threshold);
    const lowConfidence = proposals.filter((p) => p.confidence < this.threshold);

    const applied = await this.applyAnswers.execute({
      intentId,
      answers: confident.map((p) => ({ key: p.key, value: p.value })),
      mode: "fill",
    });

    const rejectedKeys = new Set(applied.rejected.map((r) => r.key));
    const skippedKeys = new Set(applied.skipped);
    const accepted = confident.map((p) => p.key).filter((k) => !rejectedKeys.has(k) && !skippedKeys.has(k));

    return {
      state: applied.state,
      accepted,
      rejected: applied.rejected,
      skipped: applied.skipped,
      lowConfidence,
      identity: applied.identity,
    };
  }

  /**
   * Extraction must never break the conversation. On any failure, propose nothing — bound mode then
   * simply asks the current question; classify mode falls back to a clarification.
   */
  private async safeExtract(request: SlotExtractionRequest, intentId?: string): Promise<SlotExtractionResult> {
    try {
      return await this.extractor.extract(request);
    } catch (err) {
      await this.audit.record({
        intentId: intentId ?? "-",
        at: this.clock.now(),
        type: "extraction.failed",
        detail: err instanceof Error ? err.message : String(err),
      });
      return { slots: [] };
    }
  }

  /**
   * The grounding context an extractor receives. The field has existed on SlotExtractionRequest all
   * along with nobody to fill it, so a PARTY mention was never extracted from natural language at
   * all — it always fell through to the guided question and was answered as free text.
   */
  private async knownParties(): Promise<{ partyId: string; name: string }[]> {
    return (await this.directory.list()).map((p) => ({ partyId: p.partyId, name: p.displayName }));
  }

  private defaultClarification(catalog: ScenarioCatalogEntry[]): string {
    return `Which operation do you mean? ${catalog.map((s) => s.title).join(" · ")}`;
  }
}
