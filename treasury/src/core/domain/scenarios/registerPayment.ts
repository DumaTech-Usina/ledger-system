import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register a general payment" — the generic cash-basis outbound payment, reserved for an outflow
 * whose specific economic category the model does not yet express (e.g. a supplier invoice). Maps to
 * the Ledger's ratified tuple OUTBOUND_PAYMENT · PAYABLE · SETTLES · CASH_OUT · ORDINARY_SETTLEMENT.
 *
 * This is deliberately NOT the universal payment button. Categories that have their own operation
 * (e.g. Payroll) must use it, so a known category is never recorded as a generic payable — a fact
 * the Ledger would accept yet would be valid-but-false. The payee is captured purely as a Party.
 * English here is the fallback; pt-BR is in the i18n catalog.
 */
export const registerPayment: Scenario = {
  id: "register_payment",
  title: "Register a general payment",
  description: "Record a general outbound payment not covered by a specific operation (e.g. a supplier). Use a specific operation when one exists (e.g. Payroll).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is being paid?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the payment amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was the payment made?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
