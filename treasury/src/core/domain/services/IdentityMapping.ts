import type { Party } from "../entities/Party";
import { PartyIdentityState } from "../enums/PartyIdentityState";
import type { IdentityLink } from "../value-objects/IdentityLink";

const nextOf = (links: readonly IdentityLink[]) =>
  new Map(links.map((link) => [link.fromIdentifier, link.toPartyId]));

/** The party an identifier ends up at. An identifier with no link is its own answer. */
export function canonicalOf(identifier: string, links: readonly IdentityLink[]): string {
  const next = nextOf(links);
  const seen = new Set([identifier]);
  let current = identifier;
  for (let to = next.get(current); to !== undefined && !seen.has(to); to = next.get(current)) {
    seen.add(to);
    current = to;
  }
  return current;
}

/** Every identifier that means this party: the id itself and whatever was linked to it (REQ-332). */
export function identifiersOf(partyId: string, links: readonly IdentityLink[]): string[] {
  const canonical = canonicalOf(partyId, links);
  const linked = links.map((l) => l.fromIdentifier).filter((id) => canonicalOf(id, links) === canonical);
  return [canonical, ...new Set(linked)];
}

/**
 * The parties as the links say they should be read. Nothing is stored this way: a linked party reads
 * as merged into its target and under its target's name, and the target also answers to any linked
 * identifier that has no row of its own (a name already written in the Ledger).
 */
export function readThroughLinks(parties: readonly Party[], links: readonly IdentityLink[]): Party[] {
  const byId = new Map(parties.map((p) => [p.partyId, p]));
  const linkedIds = new Set(links.map((l) => l.fromIdentifier));

  return parties.map((party) => {
    if (linkedIds.has(party.partyId)) {
      const canonical = canonicalOf(party.partyId, links);
      return {
        ...party,
        identityState: PartyIdentityState.MERGED,
        mergedInto: canonical,
        displayName: byId.get(canonical)?.displayName ?? party.displayName,
      };
    }
    const rowless = links
      .filter((l) => !byId.has(l.fromIdentifier) && canonicalOf(l.fromIdentifier, links) === party.partyId)
      .map((l) => l.fromIdentifier);
    return rowless.length === 0 ? party : { ...party, aliases: [...party.aliases, ...rowless] };
  });
}
