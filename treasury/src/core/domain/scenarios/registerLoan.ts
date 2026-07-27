import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register loan origination" — the usina disburses a loan to a broker. Maps to the Ledger's
 * ratified tuple LOAN_ORIGINATION · LOAN · ORIGINATES · CASH_OUT · LOAN_ORIGINATION. Cash flows out
 * now, but unlike an expense it ORIGINATES a loan receivable to be repaid later — a first-class
 * operation so a loan is never recorded as a generic payable. The borrower is captured purely as a
 * Party. English here is the fallback; pt-BR is in the i18n catalog.
 *
 * Note: this is only the disbursement (origination). Repaying the loan is a distinct operation
 * (LOAN_REPAYMENT) that links back to this event — out of scope for this scenario.
 */
export const registerLoan: Scenario = {
  id: "register_loan",
  title: "Register loan origination",
  description: "Record a loan disbursed by the usina to a broker (cash out; originates a loan receivable to be repaid later).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is receiving the loan (borrower)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the loan amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was the loan disbursed?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
