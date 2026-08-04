import type { Party } from "../entities/Party";
import { AttributeState } from "../enums/AttributeState";
import { PartyIdentityState } from "../enums/PartyIdentityState";
import { PartyAttributeKey } from "../value-objects/PartyAttribute";

/**
 * The attributes worth asking for. Kept flat rather than split per party type: both a person and a
 * company want the same two, and a per-type profile with identical contents would be a level of
 * structure carrying no information.
 *
 * These are the "recommended" layer — asked at most once, never blocking. Nothing essential lives
 * here, because conditioning a fact on a counterparty's document would lose the payment to gain an
 * attribute.
 */
export const RECOMMENDED_ATTRIBUTES = [PartyAttributeKey.DOCUMENT, PartyAttributeKey.TYPE] as const;

export interface PartyCompleteness {
  partyId: string;
  displayName: string;
  /** Recommended attributes never observed and never refused — the only ones worth asking about. */
  missing: string[];
  /** Recommended attributes the user was asked for and did not give. Never asked again in chat. */
  declined: string[];
}

/**
 * What is still unknown about a party, computed from its attributes.
 *
 * Deliberately derived and never stored. "Needs enrichment" is a question about the current
 * attributes, and a stored flag would be exactly the mutable status the architecture avoids
 * everywhere else — it would drift the moment an import filled a gap.
 */
export function completenessOf(party: Party): PartyCompleteness {
  const missing: string[] = [];
  const declined: string[] = [];

  for (const key of RECOMMENDED_ATTRIBUTES) {
    const attribute = party.attributes[key];
    if (attribute === undefined) missing.push(key);
    else if (attribute.state === AttributeState.DECLINED) declined.push(key);
  }

  return { partyId: party.partyId, displayName: party.displayName, missing, declined };
}

/**
 * Whether this party is worth one enrichment question.
 *
 * A party that could not be identified is excluded: asking for the document of a counterparty
 * whose very identity is unknown asks the user to supply what they already said they do not have.
 */
export function isWorthAsking(party: Party): boolean {
  return (
    party.identityState === PartyIdentityState.IDENTIFIED && completenessOf(party).missing.length > 0
  );
}
