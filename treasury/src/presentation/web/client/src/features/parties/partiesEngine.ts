import type { PageAlert, PartyEventView, PartyName, PendingIdentity, Side } from "@/features/parties/partiesApi";
import type { PositionItem, PositionLifecycle } from "@/types/dashboard";
import { fromCents, toCents } from "@/utils/money";

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

/** CA-636: the record date is shown only when it is a different day from the fact's. */
export function recordedOnAnotherDay(occurredAt: string, recordedAt: string): boolean {
  return occurredAt.slice(0, 10) !== recordedAt.slice(0, 10);
}

/**
 * REQ-691: the button on a line of Operação, named after what is most likely to happen there — the
 * same words the agendas use. It opens the position's detail, where every action is offered and none
 * is hidden; the label only says which way the line points. Whoever cannot write sees "Ver".
 */
export function rowAction(side: Side, canAct: boolean): "pay" | "receive" | "view" {
  if (!canAct) return "view";
  if (side === "usinaOwes") return "pay";
  if (side === "partyOwes") return "receive";
  return "view";
}

/** REQ-691: the position an alert speaks about, when it speaks about one. */
export function alertPosition(alert: PageAlert): string | null {
  return "objectId" in alert ? alert.objectId : null;
}

/**
 * The position as the shared detail view (`RowDetailModal`) reads it, built from the Ledger's own
 * lifecycle of the object — read when the detail is opened, so it shows what the book holds now,
 * not what the list held when it was loaded. Nothing is filled in: a date the lifecycle does not
 * state stays null.
 */
export function positionFromLifecycle(lifecycle: PositionLifecycle): PositionItem {
  const events = lifecycle.events;
  return {
    objectId: lifecycle.objectId,
    objectType: lifecycle.objectType,
    status: lifecycle.status,
    outcome: lifecycle.outcome,
    currency: lifecycle.currency,
    totalOriginated: lifecycle.totalOriginated,
    totalSettled: lifecycle.totalSettled,
    openBalance: lifecycle.openBalance,
    eventCount: lifecycle.eventCount,
    lastEventAt: events.length > 0 ? events[events.length - 1].occurredAt : null,
    createdAt: events.length > 0 ? events[0].recordedAt : null,
    dueAt: null,
  };
}

/** A position ticked on Operação (REQ-692): what the bar needs to know to say what is possible. */
export interface PickedLine {
  objectId: string;
  objectType: string;
  side: Side;
  openBalance: string | null;
}

/** REQ-251, DEC-025: the kinds a compensation takes, on each side. */
const COMPENSABLE_RECEIVABLES = new Set(["advance", "loan"]);
const COMPENSABLE_PAYABLES = new Set(["commission_payable"]);

/**
 * REQ-692: what the ticked positions allow, or why they allow nothing. The bar offers only this, so
 * the operator never has to know beforehand which combination does what.
 *
 * - Only what the Usina owes the party → pay it in a batch of this party (REQ-239).
 * - Exactly one advance or loan and one commission obligation → compensate, up to the smaller open
 *   balance (REQ-693). One pair per compensation: a second position on a side is refused, with why.
 * - Anything else → nothing, and the reason.
 *
 * Never a net figure (REQ-632): the maximum of a compensation is what the action could do, not a
 * balance between the two sides.
 */
export type SelectionOffer =
  | { kind: "batch" }
  | { kind: "compensate"; receivable: PickedLine; payable: PickedLine; max: string }
  | { kind: "none"; reason: "onePair" | "compensableKinds" | "receivablesOnly" | "unclassified" | "balance" };

const openCents = (line: PickedLine): bigint | null => (line.openBalance === null ? null : toCents(line.openBalance));

export function selectionOffer(picked: PickedLine[]): SelectionOffer | null {
  if (picked.length === 0) return null;
  if (picked.some((p) => p.side === "unclassified")) return { kind: "none", reason: "unclassified" };
  if (picked.some((p) => (openCents(p) ?? 0n) <= 0n)) return { kind: "none", reason: "balance" };

  const owed = picked.filter((p) => p.side === "usinaOwes");
  const owing = picked.filter((p) => p.side === "partyOwes");
  if (owing.length === 0) return { kind: "batch" };
  if (owed.length === 0) return { kind: "none", reason: "receivablesOnly" };
  if (owed.length > 1 || owing.length > 1) return { kind: "none", reason: "onePair" };

  const [receivable, payable] = [owing[0], owed[0]];
  if (!COMPENSABLE_RECEIVABLES.has(receivable.objectType) || !COMPENSABLE_PAYABLES.has(payable.objectType)) {
    return { kind: "none", reason: "compensableKinds" };
  }
  const [a, b] = [openCents(receivable)!, openCents(payable)!];
  return { kind: "compensate", receivable, payable, max: fromCents(a < b ? a : b) };
}

/** REQ-693: what the compensation would leave open on one position — shown before confirming. */
export function openAfter(open: string, digits: string): string | null {
  const cents = toCents(open);
  if (cents === null) return null;
  return fromCents(cents - BigInt(digits || "0"));
}

/** The typed amount against the pair's maximum: zero and above it are refused before sending. */
export function compensationProblem(digits: string, max: string): "zero" | "over" | null {
  const cents = BigInt(digits || "0");
  if (cents <= 0n) return "zero";
  if (cents > (toCents(max) ?? 0n)) return "over";
  return null;
}
