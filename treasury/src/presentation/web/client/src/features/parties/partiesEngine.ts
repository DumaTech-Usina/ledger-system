import type { PartyEventView, PartyName, PendingIdentity } from "@/features/parties/partiesApi";

const NAMES_SHOWN = 3;

/**
 * The names on the notification. Some are named and the rest counted, so it stays one line however
 * many are pending. Null means there is nothing to say, and that is the only way it goes away:
 * nothing here can dismiss it (REQ-321).
 */
export function pendingSummary(pending: PendingIdentity[]): { count: number; names: string } | null {
  if (pending.length === 0) return null;
  const names = pending.slice(0, NAMES_SHOWN).map((p) => p.displayName).join(", ");
  const rest = pending.length - NAMES_SHOWN;
  return { count: pending.length, names: rest > 0 ? `${names} +${rest}` : names };
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** The parties a search matches, ignoring case and accents, in alphabetical order. */
export function matchingParties(parties: PartyName[], query: string, limit = 8): PartyName[] {
  const wanted = fold(query);
  return parties
    .filter((p) => fold(p.displayName).includes(wanted))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, limit);
}

/** The others in an event, by name. An id the Directory does not know stays an id, shown as unknown. */
export function othersInEvent(event: PartyEventView, partyNames: Record<string, string>): string[] {
  const own = new Set(event.roles.map((r) => r.recordedAs));
  const others = event.parties.filter((p) => !own.has(p.partyId)).map((p) => partyNames[p.partyId] ?? p.partyId);
  return [...new Set(others)];
}
