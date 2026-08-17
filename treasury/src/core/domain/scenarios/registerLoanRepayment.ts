import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register loan repayment" — a broker repays a loan (cash in), SETTLING the loan a LOAN_ORIGINATION
 * originated. Maps to the Ledger's ratified tuple LOAN_REPAYMENT · LOAN · SETTLES · CASH_IN ·
 * LOAN_REPAYMENT, linking back to the originating loan via `origin`.
 *
 * The origin is REQUIRED: the Ledger does not admit an orphan loan repayment. A wrong or non-existent
 * reference drives a re-ask. English is the fallback; pt-BR is in the i18n catalog.
 */
export const registerLoanRepayment: Scenario = {
  id: "register_loan_repayment",
  title: "Register loan repayment",
  description: "Record a loan repayment received by the usina (cash in), settling the originating loan.",
  slots: [
    { key: "payer", type: SlotType.PARTY, prompt: "Who is repaying the loan (borrower)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What amount was repaid?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it repaid?", required: true },
    { key: "origin", type: SlotType.EVENT_REF, prompt: "Which loan does this repay?", required: true, suggestionSource: "origin_events" },
    // Optional continuity assertion: the id of the loan position this repayment moves, so the Ledger
    // projects ONE loan being repaid rather than a new object per event. Never required — absence is
    // a legitimate state (the position may simply be unknown), and it changes nothing.
    { key: "objectRef", type: SlotType.STRING, prompt: "If you know it, the id of the loan being repaid (optional).", required: false },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["quitacao", "quitar", "quitado", "reembolso"] },
};
