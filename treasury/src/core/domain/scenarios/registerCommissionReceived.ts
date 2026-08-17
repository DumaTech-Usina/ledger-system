import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register commission received" — the usina receives a commission (cash in), SETTLING the receivable
 * a COMMISSION_EXPECTED originated. Maps to the Ledger's ratified tuple COMMISSION_RECEIVED ·
 * COMMISSION_RECEIVABLE · SETTLES · CASH_IN · COMMISSION_PAYMENT, linking back to the originating
 * expected via `origin`.
 *
 * The origin is OPTIONAL: if unknown, the fact is still recorded as an explicit orphan (reason
 * UNKNOWN_ORIGIN, follow-up required) — its lineage is established later by a new fact, never by
 * fabricating an origin here. English is the fallback; pt-BR is in the i18n catalog.
 */
export const registerCommissionReceived: Scenario = {
  id: "register_commission_received",
  title: "Register commission received",
  description: "Record a commission the usina received (cash in), settling an expected commission.",
  slots: [
    // The only slot in the catalogue where an unidentifiable counterparty is admitted, and for the
    // same reason this scenario already admits UNKNOWN_ORIGIN: money that ARRIVES can arrive without
    // its sender being known, and refusing the fact would lose the whole payment to gain an
    // attribute. An outgoing payment is the opposite — you know who you paid.
    { key: "payer", type: SlotType.PARTY, prompt: "Who paid the commission (operator or counterparty)?", required: true, suggestionSource: "parties", allowUnidentifiable: true },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the commission amount received?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it received?", required: true },
    { key: "origin", type: SlotType.EVENT_REF, prompt: "Which expected commission does this settle? (leave empty if unknown)", required: false, suggestionSource: "origin_events" },
    // Optional continuity assertion: the id of the receivable position this receipt moves, so the
    // Ledger projects ONE receivable being settled rather than a new object per event. Independent of
    // `origin` above: the position may be known while the originating event is not, and an unknown
    // position is a legitimate state that changes nothing.
    { key: "objectRef", type: SlotType.STRING, prompt: "If you know it, the id of the receivable being settled (optional).", required: false },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["recebida", "recebimento"] },
};
