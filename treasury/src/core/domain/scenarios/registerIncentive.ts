import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register incentive payment" — the usina pays an incentive or bonus to a broker or partner. Maps
 * to the Ledger's ratified tuple INCENTIVE_PAYMENT · {INCENTIVE|BONUS} · SETTLES · CASH_OUT ·
 * INCENTIVE_PAYMENT — the `kind` slot selects the object (an incentive or a bonus, both first-class
 * CASH_OUT objects), so a bonus is recorded AS a bonus rather than collapsed to a generic incentive.
 * A first-class operation so it is never recorded as a generic payable. The payee (broker/partner)
 * is captured purely as a Party. English here is the fallback; pt-BR is in the i18n catalog.
 */
export const registerIncentive: Scenario = {
  id: "register_incentive",
  title: "Register incentive payment",
  description: "Record an incentive or bonus paid by the usina to a broker or partner (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is receiving the incentive (broker or partner)?", required: true, suggestionSource: "parties" },
    { key: "kind", type: SlotType.CHOICE, prompt: "Is this an incentive or a bonus?", required: true, choices: ["incentive", "bonus"] },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it paid?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["incentivo", "bonus", "bonificacao", "premiacao"] },
};
