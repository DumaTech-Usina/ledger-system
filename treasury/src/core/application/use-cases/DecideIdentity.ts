import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState } from "../../domain/services/DialogEngine";
import { SlotType } from "../../domain/enums/SlotType";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { normalizeName } from "../../domain/services/PartyNormalization";
import {
  IdentityDecisionKind,
  type IdentityDecision,
} from "../../domain/value-objects/IdentityDecision";
import type { Party } from "../../domain/entities/Party";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { PartyRepository } from "../repositories/PartyRepository";
import { userActor } from "../ports/AuditLog";
import type { ConversationLog } from "../ports/ConversationLog";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";

export interface DecideIdentityInput {
  intentId: string;
  /** The PARTY slot the decision answers. */
  slot: string;
  kind: IdentityDecisionKind;
  /** What the user said. Required for a provisional identity — it becomes the display name. */
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
 * the same event. Registration and imports mint too, through their own use cases.
 */
export class DecideIdentityUseCase {
  constructor(
    private readonly intents: IntentRepository,
    private readonly parties: PartyRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly log: ConversationLog,
  ) {}

  async execute(input: DecideIdentityInput): Promise<DecideIdentityResult> {
    const intent = await this.intents.findById(input.intentId);
    if (!intent) throw new Error(`Unknown intent: ${input.intentId}`);
    intent.assertEditable(); // before minting: a refused decision must not leave a party behind

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
      input.kind === IdentityDecisionKind.PROVISIONAL
        ? await this.provisionalFor(mention, input.userId, now)
        : this.buildUnidentifiable(slot.allowUnidentifiable === true, mention, input.justification, input.userId, now);

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

    await this.log.record({
      actor: userActor(input.userId),
      intentId: intent.id,
      at: now,
      type: "identity.decision",
      detail:
        `${input.kind} · ${input.slot} · "${mention}" → ${party.partyId} · by ${input.userId}` +
        (decision.justification ? ` · ${decision.justification}` : ""),
    });
    await this.log.record({ actor: userActor(input.userId), intentId: intent.id, at: now, type: "slot.answered", detail: input.slot });

    const state = DialogEngine.nextState(scenario, intent.answers);
    if (state.kind === "ready") intent.markAwaitingConfirmation(now);
    await this.intents.save(intent);

    return { decision, state };
  }

  /**
   * A provisional identity asks for one thing — the name the user already said. Demanding a document
   * here would make the registry a precondition for recording a fact, and the payment happened
   * whether or not the system knows who that is yet. The same name reuses the same identity, so one
   * person does not become one pending item per fact.
   */
  private async provisionalFor(mention: string, userId: string, now: string): Promise<Party> {
    if (mention === "") {
      throw new Error("A provisional identity needs the name the user used — there is nothing to record.");
    }
    const key = normalizeName(mention);
    const existing = (await this.parties.findAll()).find(
      (p) => p.identityState === PartyIdentityState.PROVISIONAL && normalizeName(p.displayName) === key,
    );
    return existing ?? this.newParty(PartyIdentityState.PROVISIONAL, mention, userId, now);
  }

  private buildUnidentifiable(
    admissible: boolean,
    mention: string,
    justification: string | undefined,
    userId: string,
    now: string,
  ): Party {
    if (!admissible) {
      throw new Error("This operation does not admit an unidentifiable counterparty.");
    }
    if (!justification?.trim()) {
      throw new Error("Declaring a counterparty unidentifiable requires a justification.");
    }
    // A mention, when there is one, is still the best label available; otherwise say nothing was known.
    return this.newParty(PartyIdentityState.UNIDENTIFIABLE, mention || UNIDENTIFIABLE_LABEL, userId, now);
  }

  /** Minted ids carry the canonical shape. Ids ADOPTED from the book keep whatever the book has. */
  private newParty(identityState: PartyIdentityState, displayName: string, userId: string, now: string): Party {
    return {
      partyId: `party-${this.ids.next()}`,
      identityState,
      displayName,
      aliases: [],
      externalIds: [],
      attributes: {},
      createdBy: userId,
      createdAt: now,
    };
  }
}
