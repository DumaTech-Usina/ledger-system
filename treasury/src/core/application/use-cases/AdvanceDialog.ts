import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState, type SlotValidationError } from "../../domain/services/DialogEngine";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { Clock } from "../ports/Clock";
import type { AuditLog } from "../ports/AuditLog";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import {
  auditDetail,
  recordableId,
  resolveIdentitySlot,
  type IdentityOutcome,
} from "../services/IdentitySlotResolution";

export interface AdvanceDialogInput {
  intentId: string;
  key: string;
  value: string;
}

export interface AdvanceDialogResult {
  state: DialogState;
  /** Present when the answer was rejected; the value is NOT recorded in that case. */
  error?: SlotValidationError;
  /**
   * Present when the answer named a PARTY. When it did not resolve to exactly one known party the
   * slot is left unfilled — so `state` simply asks again — and this carries the candidates the
   * conversation can offer. Reported next to the state rather than inside it: `DialogState` is a
   * pure function of the answers, and identity is a lookup.
   */
  identity?: IdentityOutcome;
}

export class AdvanceDialogUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLog,
    private readonly directory: PartyDirectoryPort,
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

    // Identity is resolved between validating and recording. A mention that does not resolve to
    // exactly one known party is NOT recorded — which leaves the slot blank, so nextState asks it
    // again. That is the whole barrier: it works by omission, not by an extra check.
    const resolution = await resolveIdentitySlot(slot, input.value, this.directory);
    let valueToRecord = input.value;

    if (resolution) {
      await this.audit.record({
        intentId: intent.id,
        at: this.clock.now(),
        type: "identity.resolution",
        detail: auditDetail(input.key, resolution),
      });

      const partyId = recordableId(resolution);
      if (partyId === null) {
        return {
          state: DialogEngine.nextState(scenario, intent.answers),
          identity: { slot: input.key, resolution },
        };
      }
      valueToRecord = partyId;
    }

    intent.record(input.key, valueToRecord, this.clock.now());
    await this.audit.record({ intentId: intent.id, at: this.clock.now(), type: "slot.answered", detail: input.key });
    const state = DialogEngine.nextState(scenario, intent.answers);
    if (state.kind === "ready") intent.markAwaitingConfirmation(this.clock.now());
    await this.repo.save(intent);

    return resolution ? { state, identity: { slot: input.key, resolution } } : { state };
  }
}
