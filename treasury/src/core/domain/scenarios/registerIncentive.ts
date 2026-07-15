import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register incentive payment" — the usina pays an incentive, bonus, or campaign reward to a broker
 * or partner. Maps to the Ledger's ratified tuple INCENTIVE_PAYMENT · INCENTIVE · SETTLES · CASH_OUT ·
 * INCENTIVE_PAYMENT. A first-class operation so an incentive is never recorded as a generic payable.
 * The payee (broker/partner) is captured purely as a Party. English here is the fallback; pt-BR is in
 * the i18n catalog.
 */
export const registerIncentive: Scenario = {
  id: "register_incentive",
  title: "Register incentive payment",
  description: "Record an incentive or bonus paid by the usina to a broker or partner (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is receiving the incentive (broker or partner)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the incentive amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it paid?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
