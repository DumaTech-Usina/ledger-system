import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Record a purchase" — the usina records an amount it owes to a supplier (a payable).
 * Second MVP scenario; proves the framework generalizes with data only. Economic mapping
 * is applied by CandidateMapper and validated by the Ledger gate.
 */
export const recordPurchase: Scenario = {
  id: "record_purchase",
  title: "Record a purchase",
  description: "Record a purchase the usina owes to a supplier.",
  slots: [
    { key: "supplier", type: SlotType.PARTY, prompt: "Which supplier did you buy from?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the purchase amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "What is the purchase date?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "What was purchased? (optional)", required: false },
  ],
};
