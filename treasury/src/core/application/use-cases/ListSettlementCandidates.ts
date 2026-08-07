import {
  continuityMode,
  continuityObjectType,
  continuitySlot,
  lineageSlot,
} from "../services/CandidateMapper";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PositionLookupPort } from "../ports/PositionLookupPort";

/** One position the conversation can offer, in the terms a person recognises it by. */
export interface SettlementCandidate {
  objectId: string;
  /** Null when the Ledger holds no origination — the position cannot supply lineage. */
  originEventId: string | null;
  /** The Directory's name for the counterparty; the raw id when it does not know one. */
  counterparty: string | null;
  totalOriginated: string;
  /** Present only when it differs from what was originated — i.e. partly settled already. */
  openBalance: string | null;
  currency: string;
  originatedAt: string | null;
}

export interface ListSettlementCandidatesResult {
  /** The answer keys a selection fills. Empty when this scenario admits no continuity. */
  slots: { continuity?: string; lineage?: string };
  candidates: SettlementCandidate[];
}

/**
 * The positions a settlement could be about — the material for choosing one instead of typing an id.
 *
 * The question only exists when there is something to answer it with: a scenario that admits no
 * continuity, or a Ledger holding no open position of that kind, both yield an empty list, and the
 * conversation then asks exactly what it asks today. Absence is never turned into a prompt, a
 * warning, or a pending item — it is a legitimate state.
 *
 * Nothing here verifies that the user's eventual choice is correct. Continuity is an assertion by
 * the producer, and the Ledger deliberately does not validate that axis.
 */
export class ListSettlementCandidatesUseCase {
  constructor(
    private readonly intents: IntentRepository,
    private readonly positions: PositionLookupPort,
    private readonly directory: PartyDirectoryPort,
  ) {}

  async execute(intentId: string): Promise<ListSettlementCandidatesResult> {
    const intent = await this.intents.findById(intentId);
    if (!intent) throw new Error(`Unknown intent: ${intentId}`);

    const objectType = continuityObjectType(intent.scenarioId, intent.answers);
    const slots = {
      continuity: continuitySlot(intent.scenarioId),
      lineage: lineageSlot(intent.scenarioId),
    };
    if (!objectType) return { slots: {}, candidates: [] };

    // Which shape of position this scenario's question is about is declared by the mapping, never
    // inferred. A settlement asks "which open position does this close"; a recognition asks the
    // mirror question, "which already-paid position was this what established".
    const found =
      continuityMode(intent.scenarioId) === "unoriginated"
        ? await this.positions.unoriginatedPositions(objectType)
        : // A position whose origination was rectified is not an advance waiting to be recovered: the
          // Ledger still lists it as `open` (status is derived from a zero origination, not from the
          // retraction), so the standing origination is what tells the two apart. Offering it would show
          // a figure of zero next to a date the correction removed, and a selection would point the new
          // fact's lineage at an event that never happened.
          (await this.positions.openPositions(objectType)).filter((c) => c.originatedAt !== null);
    const names = await this.nameCounterparties(found.map((c) => c.counterpartyId));

    return {
      slots,
      candidates: found.map((c) => ({
        objectId: c.objectId,
        originEventId: c.originEventId,
        // Unknown stays unknown: an id the Directory cannot name is shown as the id, and a position
        // whose origin the Ledger never recorded has no counterparty to show at all.
        counterparty: c.counterpartyId ? names[c.counterpartyId] ?? c.counterpartyId : null,
        totalOriginated: c.totalOriginated,
        openBalance: c.openBalance !== c.totalOriginated ? c.openBalance : null,
        currency: c.currency,
        originatedAt: c.originatedAt,
      })),
    };
  }

  /** Names are legibility, not truth: a Directory that is down costs labels, never the candidates. */
  private async nameCounterparties(ids: (string | null)[]): Promise<Record<string, string>> {
    const distinct = [...new Set(ids.filter((id): id is string => id !== null))];
    if (distinct.length === 0) return {};

    try {
      const parties = await Promise.all(distinct.map((id) => this.directory.get(id)));
      const names: Record<string, string> = {};
      for (const party of parties) {
        if (party) names[party.partyId] = party.displayName;
      }
      return names;
    } catch {
      return {};
    }
  }
}
