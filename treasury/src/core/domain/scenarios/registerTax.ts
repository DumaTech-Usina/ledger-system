import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register tax payment" — the usina pays an assessed tax. Maps to the Ledger's ratified tuple
 * TAX_PAYMENT · TAX · SETTLES · CASH_OUT · TAX_PAYMENT.
 *
 * A first-class operation on the same terms as the service fee above: TAX is its own ObjectType, and
 * the paid category has to survive into the reason rather than only into the position. The payee (the
 * authority) is captured purely as a Party. English here is the fallback; pt-BR is in the i18n catalog.
 */
export const registerTax: Scenario = {
  id: "register_tax",
  title: "Register tax payment",
  description: "Record a tax paid by the usina (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who is being paid (tax authority)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the tax amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it paid?", required: true },
    // Optional continuity: the obligation this payment closes, when it was recognized beforehand.
    { key: "objectRef", type: SlotType.STRING, prompt: "Which recognized obligation does this pay?", required: false },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["imposto", "impostos", "tributo", "tributos", "darf"] },
};
