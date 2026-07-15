import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register penalty payment" — the usina pays a penalty or fine. Maps to the Ledger's ratified tuple
 * PENALTY_PAYMENT · PENALTY · SETTLES · CASH_OUT · PENALTY_PAYMENT. A first-class operation so a
 * penalty is never recorded as a generic payable. The payee (authority/counterparty) is captured
 * purely as a Party. English here is the fallback; pt-BR is in the i18n catalog.
 */
export const registerPenalty: Scenario = {
  id: "register_penalty",
  title: "Register penalty payment",
  description: "Record a penalty or fine paid by the usina (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is being paid (authority or counterparty)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the penalty amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it paid?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
