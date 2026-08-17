import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register service fee payment" — the usina pays a service fee. Maps to the Ledger's ratified tuple
 * SERVICE_FEE_PAYMENT · SERVICE_FEE · SETTLES · CASH_OUT · SERVICE_FEE_PAYMENT.
 *
 * A first-class operation for the same reason infrastructure is one: the category exists as its own
 * ObjectType, so recording it as a generic payable would lose a distinction the model already makes.
 * The payee (supplier/provider) is captured purely as a Party. English here is the fallback; pt-BR is
 * in the i18n catalog.
 */
export const registerServiceFee: Scenario = {
  id: "register_service_fee",
  title: "Register service fee payment",
  description: "Record a service fee paid by the usina (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is being paid (supplier or provider)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the fee amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it paid?", required: true },
    // Optional continuity: the obligation this payment closes, when it was recognized beforehand.
    { key: "objectRef", type: SlotType.STRING, prompt: "Which recognized obligation does this pay?", required: false },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["taxa", "taxas", "honorario", "honorarios", "servico"] },
};
