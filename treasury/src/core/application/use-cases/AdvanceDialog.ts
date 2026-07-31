import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState, type SlotValidationError } from "../../domain/services/DialogEngine";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { Clock } from "../ports/Clock";
import type { AuditLog } from "../ports/AuditLog";

export interface AdvanceDialogInput {
  intentId: string;
  key: string;
  value: string;
}

export interface AdvanceDialogResult {
  state: DialogState;
  /** Present when the answer was rejected; the value is NOT recorded in that case. */
  error?: SlotValidationError;
}

export class AdvanceDialogUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLog,
  ) {}

  async execute(input: AdvanceDialogInput): Promise<AdvanceDialogResult> {
    const intent = await this.repo.findById(input.intentId);
    if (!intent) throw new Error(`Unknown intent: ${input.intentId}`);

    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    const slot = scenario.slots.find((s) => s.key === input.key);
    if (!slot) throw new Error(`Unknown slot '${input.key}' for scenario '${scenario.id}'`);

    const error = DialogEngine.validateAnswer(slot, input.value);
    if (error) {
      // Reject without recording — never persist an invalid answer.
      await this.audit.record({ intentId: intent.id, at: this.clock.now(), type: "slot.rejected", detail: `${input.key}: ${error.message}` });
      return { state: DialogEngine.nextState(scenario, intent.answers), error };
    }

    intent.record(input.key, input.value, this.clock.now());
    await this.audit.record({ intentId: intent.id, at: this.clock.now(), type: "slot.answered", detail: input.key });
    const state = DialogEngine.nextState(scenario, intent.answers);
    if (state.kind === "ready") intent.markAwaitingConfirmation(this.clock.now());
    await this.repo.save(intent);

    return { state };
  }
}
