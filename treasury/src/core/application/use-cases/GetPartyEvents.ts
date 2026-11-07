import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import type { PartyEvent } from "../dtos/LedgerReadModels";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PartyEventsPort } from "../ports/PartyEventsPort";

export interface PartyEventView extends PartyEvent {
  /** The parts this party plays in the event, and the identifier each was recorded under. */
  roles: { role: string; direction: string; recordedAs: string }[];
}

export type PartyEventsResult =
  | {
      available: true;
      party: { partyId: string; displayName: string };
      /** Every identifier read for this party: its own, and what was linked to it (REQ-332). */
      identifiers: string[];
      events: PartyEventView[];
      /** partyId → name, for everyone in these events. An id the Directory does not know stays an id. */
      partyNames: Record<string, string>;
    }
  | { available: false; party: { partyId: string; displayName: string } };

const newestFirst = (a: PartyEvent, b: PartyEvent) =>
  b.occurredAt.localeCompare(a.occurredAt) || b.recordedAt.localeCompare(a.recordedAt);

/**
 * Everything the Ledger recorded about one party, in any role (REQ-615), under any identifier it has
 * been known by (REQ-332), read at query time: nothing in the Ledger changes for this to work.
 *
 * It exists to filter and see (REQ-612), so it adds nothing up. How a person relates to a company is
 * whatever each event says (REQ-611): the others in an event are shown, and no rule ties them together.
 *
 * `null` means the Directory does not know this party. An unreachable Ledger is `available: false`,
 * never an empty list: "no events" and "could not read" must not look alike (REQ-602).
 */
export class GetPartyEventsUseCase {
  constructor(
    private readonly ledger: PartyEventsPort,
    private readonly directory: PartyDirectoryPort,
  ) {}

  async execute(partyId: string): Promise<PartyEventsResult | null> {
    const asked = await this.directory.get(partyId);
    if (!asked) return null;

    const canonical =
      asked.identityState === PartyIdentityState.MERGED && asked.mergedInto ? asked.mergedInto : asked.partyId;
    const party = { partyId: canonical, displayName: asked.displayName };
    const identifiers = await this.directory.identifiersOf(canonical);

    let lists: PartyEvent[][];
    try {
      lists = await Promise.all(identifiers.map((id) => this.ledger.eventsOfParty(id)));
    } catch {
      // All or nothing: part of a history would read as the whole of it.
      return { available: false, party };
    }

    const byId = new Map(lists.flat().map((event) => [event.eventId, event]));
    const known = new Set(identifiers);
    const events = [...byId.values()].sort(newestFirst).map(
      (event): PartyEventView => ({
        ...event,
        roles: event.parties
          .filter((p) => known.has(p.partyId))
          .map((p) => ({ role: p.role, direction: p.direction, recordedAs: p.partyId })),
      }),
    );

    return { available: true, party, identifiers, events, partyNames: await this.namesIn(events) };
  }

  private async namesIn(events: PartyEvent[]): Promise<Record<string, string>> {
    const ids = [...new Set(events.flatMap((e) => e.parties.map((p) => p.partyId)))];
    const parties = await Promise.all(ids.map(async (id) => [id, await this.directory.get(id)] as const));
    return Object.fromEntries(parties.flatMap(([id, party]) => (party ? [[id, party.displayName]] : [])));
  }
}
