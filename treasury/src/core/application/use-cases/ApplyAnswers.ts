import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState, type SlotValidationError } from "../../domain/services/DialogEngine";
import type { SlotValue } from "../../domain/value-objects/Slot";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { Clock } from "../ports/Clock";
import type { AuditLog } from "../ports/AuditLog";

/**
 * How a batch of answers treats slots that are already filled.
 * - `fill` (default): only fill empty slots; an already-filled slot is skipped, never overwritten.
 * - `edit`: explicit user edit; an already-filled slot is overwritten and re-validated.
 */
export type ApplyMode = "fill" | "edit";

export interface ApplyAnswersInput {
  intentId: string;
  answers: { key: string; value: SlotValue }[];
  /** Defaults to `fill`. */
  mode?: ApplyMode;
}

export interface ApplyAnswersResult {
  state: DialogState;
  /** Answers that failed validation (or named an unknown slot). Never recorded. */
  rejected: SlotValidationError[];
  /** Keys skipped because the slot was already filled and mode is `fill`. */
  skipped: string[];
}

const isBlank = (v: SlotValue | undefined): boolean => v === undefined || v.trim() === "";

/**
 * Deterministic multi-slot merge — the batch analog of {@link AdvanceDialogUseCase}. Validates each
 * proposed answer through the same DialogEngine and records only the valid ones, honouring the
 * overwrite policy. It is the shared spine both the natural-language path (proposals) and the
 * confirmation edit path feed. No LLM, no economic mapping: it only decides which answers are legal
 * and merges them, leaving the Ledger the sole authority over the eventual candidate.
 */
export class ApplyAnswersUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLog,
  ) {}

  async execute(input: ApplyAnswersInput): Promise<ApplyAnswersResult> {
    const intent = await this.repo.findById(input.intentId);
    if (!intent) throw new Error(`Unknown intent: ${input.intentId}`);

    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    const mode: ApplyMode = input.mode ?? "fill";
    const now = this.clock.now();
    const rejected: SlotValidationError[] = [];
    const skipped: string[] = [];
    let recorded = 0;

    for (const { key, value } of input.answers) {
      const slot = scenario.slots.find((s) => s.key === key);
      if (!slot) {
        // Never throw on an unknown key (a proposer may over-extract): report and move on.
        rejected.push({ key, message: `Unknown slot '${key}' for scenario '${scenario.id}'.` });
        continue;
      }

      // Overwrite policy: in `fill` mode an already-filled slot is left untouched.
      if (mode === "fill" && !isBlank(intent.answers[key])) {
        skipped.push(key);
        continue;
      }

      const error = DialogEngine.validateAnswer(slot, value);
      if (error) {
        // Reject without recording — never persist an invalid answer.
        rejected.push(error);
        await this.audit.record({ intentId: intent.id, at: now, type: "slot.rejected", detail: `${key}: ${error.message}` });
        continue;
      }

      intent.record(key, value, now);
      await this.audit.record({ intentId: intent.id, at: now, type: "slot.answered", detail: key });
      recorded += 1;
    }

    const state = DialogEngine.nextState(scenario, intent.answers);
    if (recorded > 0) {
      if (state.kind === "ready") intent.markAwaitingConfirmation(now);
      await this.repo.save(intent);
    }

    return { state, rejected, skipped };
  }
}
