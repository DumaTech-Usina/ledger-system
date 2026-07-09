import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Add a charge" — the usina registers an amount owed to it by a counterparty.
 * Modeled on the Advance flow's candidate shape (see AdvanceStagingJob). The economic
 * tuple this maps to is applied by CandidateMapper and validated by the Ledger gate; the
 * User App only gathers the human intent.
 */
export const addCharge: Scenario = {
  id: "add_charge",
  title: "Add a charge",
  description: "Register a charge owed to the usina by a counterparty.",
  slots: [
    { key: "counterparty", type: SlotType.PARTY, prompt: "Who is being charged?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "How much is the charge?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "What date does this charge apply to?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
