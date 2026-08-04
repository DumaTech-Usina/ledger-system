import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import type { Candidate } from "../../domain/value-objects/Candidate";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";

/**
 * Which of a candidate's parties the Directory holds as explicitly not identifiable.
 *
 * Shared by preview and submit on purpose: the card a user confirms and the candidate the Ledger
 * receives must carry the same disclosure, or the confirmation would be of something else.
 *
 * A party the Directory does not know is NOT reported here. Absence of information is not the same
 * as information about an absence, and only the second one is a fact worth recording.
 */
export async function unidentifiedPartiesOf(
  candidate: Candidate,
  directory: PartyDirectoryPort,
): Promise<Set<string>> {
  const ids = [...new Set(candidate.parties.map((p) => p.partyId))];
  const parties = await Promise.all(ids.map((id) => directory.get(id)));
  return new Set(
    parties
      .filter((p) => p?.identityState === PartyIdentityState.UNIDENTIFIABLE)
      .map((p) => p!.partyId),
  );
}
