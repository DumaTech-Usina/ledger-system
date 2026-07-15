import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register payroll" — the usina pays its employees. Maps to the Ledger's ratified tuple
 * PAYROLL_PAYMENT · PAYROLL · SETTLES · CASH_OUT · PAYROLL_PAYMENT. Kept as a first-class operation,
 * distinct from the generic payment, so payroll is never recorded as a generic payable — which the
 * Ledger would accept yet would be a valid-but-false accounting fact. The beneficiary is captured
 * purely as a Party. English here is the fallback; pt-BR is in the i18n catalog.
 */
export const registerPayroll: Scenario = {
  id: "register_payroll",
  title: "Register payroll",
  description: "Record a payroll payment made by the usina to its employees (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is being paid (employee or payroll provider)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the payroll amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was payroll paid?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
