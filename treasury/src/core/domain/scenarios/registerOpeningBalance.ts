import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";
import { CURRENCY_SLOT } from "../value-objects/Slot";
import { OPENING_INSTITUTION_SLOT } from "../services/Institutions";

/**
 * "Register an institution's opening balance" (§8.8, REQ-670): what one institution's statement
 * showed at the end of a day, so its balance can be known from there on. Not money that came in:
 * the Ledger keeps it out of every cash-flow total.
 *
 * Registered from the institutions screen, which first checks that no opening stands for that
 * institution — never through the free conversation (`conversational: false`).
 */
export const registerOpeningBalance: Scenario = {
  id: "register_opening_balance",
  title: "Register an opening balance",
  description: "Record what an institution's statement showed at the end of a day, as the starting point of its balance.",
  conversational: false,
  slots: [
    OPENING_INSTITUTION_SLOT,
    {
      key: "side",
      type: SlotType.CHOICE,
      prompt: "Was the balance positive, or overdrawn?",
      required: true,
      choices: ["positive", "overdrawn"],
    },
    { key: "amount", type: SlotType.MONEY, prompt: "What balance did the statement show?", required: true },
    CURRENCY_SLOT,
    { key: "occurredAt", type: SlotType.DATE, prompt: "On which day did the statement end with this balance?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
