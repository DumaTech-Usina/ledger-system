import { env } from "../../config/env";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";

/**
 * The canonical parties the suite works with — one place, so no test invents an identity.
 *
 * Before this fixture, tests filled PARTY slots with free text ("ACME"), which is exactly the
 * defect the Directory removes: a typed string became a party id and, from there, an entity in an
 * immutable event. Every test now names a party through these constants instead, so when resolution
 * starts rejecting unresolvable mentions, a failing test means a real defect rather than a fixture
 * that was never migrated.
 */
export const PARTY = {
  /**
   * The host company. Read from configuration, never written down here: the usina is the one party
   * the Directory does not resolve — it is not a counterparty anyone mentions, it is who "we" are —
   * so `.env` is its single source, and a test that hardcoded it would let production and the
   * suite drift apart silently.
   */
  USINA: env.USINA_PARTY_ID,
  ACME: "party-acme",
  BROKER: "party-broker",
  OPERATOR: "party-operator",
  AUTHORITY: "party-authority",
  /** A second counterparty, for tests that need "a different party" and nothing more. */
  OTHER: "party-other",
} as const;

/** How the Directory would display each id. The name is what a user would actually say. */
export const PARTY_DISPLAY_NAMES: Record<string, string> = {
  [PARTY.USINA]: "Usina",
  [PARTY.ACME]: "ACME",
  [PARTY.BROKER]: "Corretor Parceiro",
  [PARTY.OPERATOR]: "Operadora A",
  [PARTY.AUTHORITY]: "Autoridade Fiscal",
  [PARTY.OTHER]: "Outra Contraparte",
};

/** The grounding context an extractor receives — a proposer may hint, the Directory decides. */
export function knownParties(): { partyId: string; name: string }[] {
  return Object.entries(PARTY_DISPLAY_NAMES).map(([partyId, name]) => ({ partyId, name }));
}

/**
 * A Directory holding exactly the canonical parties above. Every test that walks the dialog needs
 * one, because a PARTY answer is now only recorded when it resolves against a real directory.
 */
export function partyDirectory(): PartyDirectory {
  return seededDirectory().directory;
}

/** Same directory, with its repository exposed — for tests that also need to write or inspect. */
export function seededDirectory(): { directory: PartyDirectory; repo: InMemoryPartyRepository } {
  const repo = new InMemoryPartyRepository();
  for (const [partyId, displayName] of Object.entries(PARTY_DISPLAY_NAMES)) {
    void repo.save({
      partyId,
      identityState: PartyIdentityState.IDENTIFIED,
      displayName,
      aliases: [],
      externalIds: [],
      attributes: {},
    });
  }
  return { directory: new PartyDirectory(repo), repo };
}

/** A Directory that knows nobody — for asserting that an unknown mention is never recorded. */
export function emptyPartyDirectory(): PartyDirectory {
  return new PartyDirectory(new InMemoryPartyRepository());
}
