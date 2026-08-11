import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PositionLifecycle } from "../dtos/LedgerReadModels";

/**
 * The life of one object, plus the display names of everyone who took part in it.
 *
 * `partyNames` sits BESIDE the lifecycle rather than inside its events — the same separation
 * `TreasuryDashboard.partyNames` makes, and for the same reason: the lifecycle mirrors what the
 * Ledger published, and the Ledger publishes ids. A name is treasury's own knowledge.
 *
 * A party the Directory does not know is simply absent from the map, so its id stays on screen.
 */
export interface ObjectLifecycleView extends PositionLifecycle {
  partyNames: Record<string, string>;
}

/**
 * Shows how one economic object evolved: originated, then settled — fully, partially, or at a loss.
 * The Ledger owns that projection; this only asks for it. `null` when the object is unknown, which
 * is a legitimate state (Treasury never asserts that an absent object never existed).
 */
export class GetObjectLifecycleUseCase {
  constructor(
    private readonly ledger: PositionLifecyclePort,
    /**
     * Optional: without it the view answers with ids alone, which is exactly what it does for a
     * party the Directory does not know. Names are legibility, not truth, so their absence never
     * changes what the screen asserts.
     */
    private readonly directory?: PartyDirectoryPort,
  ) {}

  async execute(objectId: string): Promise<ObjectLifecycleView | null> {
    const lifecycle = await this.ledger.lifecycle(objectId);
    if (!lifecycle) return null;

    return { ...lifecycle, partyNames: await this.nameParties(lifecycle) };
  }

  /**
   * Looks up a display name for every party named anywhere in the object's life — the origination's
   * counterparty and every later settlement's.
   *
   * Deliberately outside any failure path: a Directory that is down does not make the Ledger's
   * projection unavailable, so it degrades to ids rather than taking the whole read with it.
   */
  private async nameParties(lifecycle: PositionLifecycle): Promise<Record<string, string>> {
    if (!this.directory) return {};

    const ids = [
      ...new Set([
        ...lifecycle.events.flatMap((event) => event.parties.map((p) => p.partyId)),
        ...(lifecycle.origin?.parties ?? []).map((p) => p.partyId),
      ]),
    ];
    if (ids.length === 0) return {};

    try {
      const parties = await Promise.all(ids.map((id) => this.directory!.get(id)));
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
