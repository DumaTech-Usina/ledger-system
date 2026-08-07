import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register infrastructure expense" — the usina pays an operational/infrastructure cost. Maps to the
 * Ledger's ratified tuple INFRASTRUCTURE_EXPENSE · INFRASTRUCTURE_COST · SETTLES · CASH_OUT ·
 * INFRASTRUCTURE_EXPENSE. A first-class operation so infrastructure costs are never recorded as a
 * generic payable. The payee (supplier/provider) is captured purely as a Party. English here is the
 * fallback; pt-BR is in the i18n catalog.
 */
export const registerInfrastructure: Scenario = {
  id: "register_infrastructure",
  title: "Register infrastructure expense",
  description: "Record an infrastructure/operational cost paid by the usina (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is being paid (supplier or provider)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it paid?", required: true },
    // Optional continuity: the obligation this payment closes, when it was recognized beforehand.
    { key: "objectRef", type: SlotType.STRING, prompt: "Which recognized obligation does this pay?", required: false },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["infraestrutura", "infra", "hospedagem"] },
};
