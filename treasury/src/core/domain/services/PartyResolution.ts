import type { Party } from "../entities/Party";
import { PartyIdentityState } from "../enums/PartyIdentityState";
import { PartyAttributeKey } from "../value-objects/PartyAttribute";
import { normalizeDocument, normalizeName, similarity } from "./PartyNormalization";

/**
 * The raw text a user used to refer to a counterparty, alongside its comparison key. A Mention is
 * deliberately a different thing from a PartyId: today the text *is* the id, and that is exactly the
 * defect this concept removes. A mention is what gets resolved; an id is what resolution produces.
 */
export interface Mention {
  text: string;
  normalized: string;
}

/** Which rung of the cascade produced the answer. Recorded so a resolution can be explained later. */
export enum ResolutionRule {
  EXACT_ID = "exact_id",
  EXACT_DOCUMENT = "exact_document",
  EXACT_EXTERNAL_ID = "exact_external_id",
  EXACT_NAME = "exact_name",
  SIMILARITY = "similarity",
}

/**
 * What is known about the counterparty being looked up. The conversational path supplies only
 * `mention`; an importer may also supply the structured identifiers, which is what makes rungs 2
 * and 3 reachable.
 */
export interface ResolutionQuery {
  mention: string;
  document?: string;
  externalId?: { system: string; value: string };
}

export interface ResolutionCandidate {
  partyId: string;
  displayName: string;
  /** In [0, 1]. */
  score: number;
}

/**
 * The outcome of running the cascade — the Resolution itself, carrying the mention it started from
 * and the rule that decided, so "why did this mention become this entity" stays answerable.
 *
 * `resolved` with `needsConfirmation` is a similarity hit, not an equality one: the caller must ask
 * before using it. Similarity is never silently promoted to identity.
 */
export type Resolution =
  | {
      kind: "resolved";
      mention: Mention;
      partyId: string;
      rule: ResolutionRule;
      score: number;
      needsConfirmation: boolean;
    }
  | { kind: "ambiguous"; mention: Mention; candidates: ResolutionCandidate[] }
  | { kind: "new"; mention: Mention };

/**
 * Similarity at or above this counts as a candidate. Conservative on purpose: a loose threshold
 * produces false positives, and a false positive merges two real counterparties into one aggregate
 * — irreversibly, since events are immutable. Calibrated against real data in the seeding phase.
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/** A merged party answers for its survivor; every other state answers for itself. */
function effectiveId(party: Party): string {
  return party.identityState === PartyIdentityState.MERGED && party.mergedInto
    ? party.mergedInto
    : party.partyId;
}

/** Every string this party may be matched by, already normalized. */
function nameKeys(party: Party): string[] {
  return [party.displayName, ...party.aliases].map(normalizeName);
}

/**
 * The deterministic resolution cascade, strongest rung first. Pure: it reads the supplied parties
 * and returns an answer, mutating nothing and reaching nothing outside its arguments.
 *
 *   1. exact PartyId            4. exact display name or alias
 *   2. exact document           5. similarity, single candidate  → resolved, needs confirmation
 *   3. exact external id        6. similarity, several candidates → ambiguous
 *                               7. nothing                        → new
 *
 * Rung 6 never picks the most likely of several. Choosing between two same-named counterparties is
 * how two distinct entities get summed into one, and the resulting damage cannot be undone.
 */
export function resolveParty(
  query: ResolutionQuery,
  parties: readonly Party[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): Resolution {
  const mention: Mention = { text: query.mention, normalized: normalizeName(query.mention) };

  const resolved = (party: Party, rule: ResolutionRule, score: number, needsConfirmation = false): Resolution => ({
    kind: "resolved",
    mention,
    partyId: effectiveId(party),
    rule,
    score,
    needsConfirmation,
  });

  // 1 — exact PartyId. The mention may itself already be an id (a caller passing one through).
  const byId = parties.find((p) => p.partyId === query.mention);
  if (byId) return resolved(byId, ResolutionRule.EXACT_ID, 1);

  // 2 — exact document. Two parties with the same document are by definition the same party.
  if (query.document) {
    const wanted = normalizeDocument(query.document);
    if (wanted !== "") {
      const byDocument = parties.find((p) => {
        const held = p.attributes[PartyAttributeKey.DOCUMENT]?.value;
        return held !== undefined && normalizeDocument(held) === wanted;
      });
      if (byDocument) return resolved(byDocument, ResolutionRule.EXACT_DOCUMENT, 1);
    }
  }

  // 3 — exact external id, scoped to its originating system (external ids are unique per system).
  if (query.externalId) {
    const { system, value } = query.externalId;
    const byExternal = parties.find((p) =>
      p.externalIds.some((e) => e.system === system && e.value === value),
    );
    if (byExternal) return resolved(byExternal, ResolutionRule.EXACT_EXTERNAL_ID, 1);
  }

  // 4 — exact normalized name or alias.
  if (mention.normalized !== "") {
    const byName = parties.find((p) => nameKeys(p).includes(mention.normalized));
    if (byName) return resolved(byName, ResolutionRule.EXACT_NAME, 1);
  }

  // 5/6 — similarity. Best score per party, then everything at or above the threshold.
  if (mention.normalized === "") return { kind: "new", mention };

  const candidates: ResolutionCandidate[] = parties
    .map((p) => ({
      partyId: effectiveId(p),
      displayName: p.displayName,
      score: Math.max(...nameKeys(p).map((key) => similarity(mention.normalized, key))),
    }))
    .filter((c) => c.score >= threshold)
    // Stable ordering: best first, ties broken by id so the same input always yields the same list.
    .sort((a, b) => b.score - a.score || a.partyId.localeCompare(b.partyId));

  // A merged party and its survivor can both clear the threshold; they are one entity, not two.
  const distinct = candidates.filter((c, i) => candidates.findIndex((o) => o.partyId === c.partyId) === i);

  if (distinct.length === 1) {
    return {
      kind: "resolved",
      mention,
      partyId: distinct[0].partyId,
      rule: ResolutionRule.SIMILARITY,
      score: distinct[0].score,
      needsConfirmation: true,
    };
  }
  if (distinct.length > 1) return { kind: "ambiguous", mention, candidates: distinct };

  // 7 — nothing matched. Creating the entity is an explicit decision, taken elsewhere.
  return { kind: "new", mention };
}
