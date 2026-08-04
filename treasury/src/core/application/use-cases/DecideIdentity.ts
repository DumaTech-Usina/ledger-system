import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState } from "../../domain/services/DialogEngine";
import { SlotType } from "../../domain/enums/SlotType";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import {
  IdentityDecisionKind,
  type IdentityDecision,
} from "../../domain/value-objects/IdentityDecision";
import type { Party } from "../../domain/entities/Party";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { PartyRepository } from "../repositories/PartyRepository";
import type { AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";

export interface DecideIdentityInput {
  intentId: string;
  /** The PARTY slot the decision answers. */
  slot: string;
  kind: IdentityDecisionKind;
  /** What the user said. Required to CREATE — it becomes the display name. */
  mention?: string;
  /** Required to declare UNIDENTIFIABLE. */
  justification?: string;
  userId: string;
}

export interface DecideIdentityResult {
  decision: IdentityDecision;
  state: DialogState;
}

/**
 * The label an unidentifiable party carries. It is not a guess at who they are — it says exactly
 * what is known, which is nothing. `identityState` carries the truth; this only makes it legible.
 */
const UNIDENTIFIABLE_LABEL = "Contraparte não identificada";

/**
 * The ONLY place a PartyId is minted in a conversation. Every other path — resolution, extraction,
 * the merge, submission — can consume ids but never bring one into existence.
 *
 * That concentration is the point. A conversational PartyId now always traces to a decision with an
 * author and a moment, so "someone created this identity" and "someone typed a string" stop being
 * the same event. Imports mint too, but through their own use case and with their own provenance.
 */
export class DecideIdentityUseCase {
  constructor(
    private readonly intents: IntentRepository,
    private readonly parties: PartyRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
  ) {}

  async execute(input: DecideIdentityInput): Promise<DecideIdentityResult> {
    const intent = await this.intents.findById(input.intentId);
    if (!intent) throw new Error(`Unknown intent: ${input.intentId}`);

    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    const slot = scenario.slots.find((s) => s.key === input.slot);
    if (!slot) throw new Error(`Unknown slot '${input.slot}' for scenario '${scenario.id}'`);
    if (slot.type !== SlotType.PARTY) {
      throw new Error(`Slot '${input.slot}' does not hold an identity.`);
    }

    const mention = (input.mention ?? "").trim();
    const now = this.clock.now();
    const party =
      input.kind === IdentityDecisionKind.CREATE
        ? this.buildCreated(mention)
        : this.buildUnidentifiable(slot.allowUnidentifiable === true, mention, input.justification);

    await this.parties.save(party);
    intent.record(input.slot, party.partyId, now);

    const decision: IdentityDecision = {
      kind: input.kind,
      partyId: party.partyId,
      mention,
      slot: input.slot,
      justification: input.justification?.trim() || undefined,
      decidedBy: input.userId,
      decidedAt: now,
      intentId: intent.id,
    };

    await this.audit.record({
      intentId: intent.id,
      at: now,
      type: "identity.decision",
      detail:
        `${input.kind} · ${input.slot} · "${mention}" → ${party.partyId} · by ${input.userId}` +
        (decision.justification ? ` · ${decision.justification}` : ""),
    });
    await this.audit.record({ intentId: intent.id, at: now, type: "slot.answered", detail: input.slot });

    const state = DialogEngine.nextState(scenario, intent.answers);
    if (state.kind === "ready") intent.markAwaitingConfirmation(now);
    await this.intents.save(intent);

    return { decision, state };
  }

  /**
   * Creation asks for one attribute — the name the user already said. Demanding a document here
   * would make enrichment a precondition for recording a fact, and the payment happened whether or
   * not the system knows the supplier's CNPJ.
   */
  private buildCreated(mention: string): Party {
    if (mention === "") {
      throw new Error("Creating a party needs the name the user used — there is nothing to record.");
    }
    return this.newParty(PartyIdentityState.IDENTIFIED, mention);
  }

  private buildUnidentifiable(admissible: boolean, mention: string, justification?: string): Party {
    if (!admissible) {
      throw new Error("This operation does not admit an unidentifiable counterparty.");
    }
    if (!justification?.trim()) {
      throw new Error("Declaring a counterparty unidentifiable requires a justification.");
    }
    // A mention, when there is one, is still the best label available; otherwise say nothing was known.
    return this.newParty(PartyIdentityState.UNIDENTIFIABLE, mention || UNIDENTIFIABLE_LABEL);
  }

  /** Minted ids carry the canonical shape. Ids ADOPTED from the book keep whatever the book has. */
  private newParty(identityState: PartyIdentityState, displayName: string): Party {
    return {
      partyId: `party-${this.ids.next()}`,
      identityState,
      displayName,
      aliases: [],
      externalIds: [],
      attributes: {},
    };
  }
}
