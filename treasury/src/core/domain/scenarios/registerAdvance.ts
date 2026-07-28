import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register advance payment" — the usina disburses an advance to a broker or partner. Maps to the
 * Ledger's ratified tuple ADVANCE_PAYMENT · ADVANCE · ORIGINATES · CASH_OUT · ADVANCE_PAYMENT. Cash
 * flows out now, but unlike an expense it ORIGINATES an advance to be settled later — a first-class
 * operation so an advance is never recorded as a generic payable. The recipient is captured purely
 * as a Party. English here is the fallback; pt-BR is in the i18n catalog.
 *
 * Note: this is only the disbursement (origination). Recovering/settling the advance is a distinct
 * operation (ADVANCE_SETTLEMENT) that links back to this event — out of scope for this scenario.
 */
export const registerAdvance: Scenario = {
  id: "register_advance",
  title: "Register advance payment",
  description: "Record an advance disbursed by the usina to a broker or partner (cash out; originates an advance to be settled later).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is receiving the advance (broker or partner)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the advance amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was the advance disbursed?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["adiantamento", "adiantar"] },
};
