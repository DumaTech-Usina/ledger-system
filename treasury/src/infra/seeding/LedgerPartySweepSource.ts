import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { PartySeed, PartySeedSource } from "../../core/application/ports/PartySeedSource";

/**
 * Harvests the party ids already present in the Ledger's events, through the read API the Treasury
 * already consumes. No Ledger change, no new dependency: cash movements are queried by the usina's
 * own id and each one names its counterparty — which is the raw `partyId` string.
 *
 * These ids are ADOPTED, not minted. Many are free-text literals written before identity was
 * resolved ("ACME Foods", "corretor"); each becomes a Party keyed by that exact literal, so the join
 * against immutable events keeps working and history converges in the Directory instead of in the
 * book. Consolidating the duplicates among them is a later, separate decision.
 */
export class LedgerPartySweepSource implements PartySeedSource {
  readonly system = "ledger";

  constructor(
    private readonly ledger: LedgerReadPort,
    private readonly usinaPartyId: string,
    private readonly limit = 500,
  ) {}

  async fetch(): Promise<PartySeed[]> {
    const page = await this.ledger.cashMovements({ partyId: this.usinaPartyId, limit: this.limit });

    // The usina is a party in every one of these movements, so it is seeded from what we already
    // know rather than harvested from the counterparty field, where it never appears.
    const distinct = new Map<string, PartySeed>([
      [this.usinaPartyId, { partyId: this.usinaPartyId, displayName: this.usinaPartyId }],
    ]);

    for (const movement of page.items) {
      const partyId = movement.counterparty?.trim();
      // A movement with no counterparty is a gap in what the book records, not an entity.
      if (!partyId) continue;
      if (!distinct.has(partyId)) {
        distinct.set(partyId, { partyId, displayName: partyId });
      }
    }

    return [...distinct.values()];
  }
}
