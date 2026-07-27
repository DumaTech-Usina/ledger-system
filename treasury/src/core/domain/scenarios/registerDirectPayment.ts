import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Acknowledge direct payment" — the operator paid the broker directly, bypassing the usina, so the
 * usina records the settlement of its commission receivable even though NO cash arrived. Maps to the
 * Ledger's ratified tuple DIRECT_PAYMENT_ACKNOWLEDGED · {COMMISSION_RECEIVABLE, COMMISSION_ENTITLEMENT}
 * · SETTLES · NON_CASH · DIRECT_COMMISSION_PAYMENT_AUTHORIZED. Both the receivable and the broker's
 * entitlement are discharged (two objects). No party carries an amount (non-cash); the broker is the
 * single BENEFICIARY party. English here is the fallback; pt-BR is in the i18n catalog.
 */
export const registerDirectPayment: Scenario = {
  id: "register_direct_payment",
  title: "Acknowledge direct payment to a broker",
  description: "Record that the operator paid a broker directly — the usina's commission receivable is settled with no cash movement.",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Which broker was paid directly?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the commission amount that was settled?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was the broker paid?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
