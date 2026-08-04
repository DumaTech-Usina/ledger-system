import { AttributeSource } from "../../domain/enums/AttributeSource";
import { AttributeState } from "../../domain/enums/AttributeState";
import { RECOMMENDED_ATTRIBUTES } from "../../domain/services/PartyCompleteness";
import type { Party } from "../../domain/entities/Party";
import type { AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";
import type { PartyRepository } from "../repositories/PartyRepository";

export interface RecordPartyAttributeInput {
  partyId: string;
  key: string;
  /** The value the user gave. Absent or blank means they declined to answer. */
  value?: string;
  userId: string;
  /** The conversation the answer came from, when it came from one. */
  intentId?: string;
}

/**
 * Answers one enrichment question — or records that the user would not.
 *
 * "Declined" is stored as its own state rather than collapsed into "unknown", because the two mean
 * different things to the conversation: unknown may be asked, declined never is again. Collapsing
 * them is what makes a system nag forever.
 *
 * A known value is never overwritten here. Enrichment fills gaps; correcting what is already known
 * is a different act, with a different burden of proof.
 */
export class RecordPartyAttributeUseCase {
  constructor(
    private readonly parties: PartyRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLog,
  ) {}

  async execute(input: RecordPartyAttributeInput): Promise<Party> {
    if (!RECOMMENDED_ATTRIBUTES.includes(input.key as (typeof RECOMMENDED_ATTRIBUTES)[number])) {
      throw new Error(`'${input.key}' is not an attribute the conversation asks for.`);
    }

    const party = await this.parties.findById(input.partyId);
    if (!party) throw new Error(`Unknown party: ${input.partyId}`);

    const existing = party.attributes[input.key];
    if (existing?.state === AttributeState.KNOWN) return party;

    const value = input.value?.trim();
    const now = this.clock.now();
    const declined = !value;

    const updated: Party = {
      ...party,
      attributes: {
        ...party.attributes,
        [input.key]: {
          state: declined ? AttributeState.DECLINED : AttributeState.KNOWN,
          value: declined ? undefined : value,
          source: AttributeSource.USER,
          confidence: 1,
          capturedAt: now,
          capturedBy: input.userId,
          intentId: input.intentId,
        },
      },
    };

    await this.parties.save(updated);

    if (input.intentId) {
      await this.audit.record({
        intentId: input.intentId,
        at: now,
        type: "party.enriched",
        detail: `${input.partyId} · ${input.key} · ${declined ? "declined" : "known"} · by ${input.userId}`,
      });
    }

    return updated;
  }
}
