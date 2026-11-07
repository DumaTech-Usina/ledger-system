import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";
import { CURRENCY_SLOT } from "../value-objects/Slot";

/**
 * "Register commission pass-through" — money leaves the usina's account for someone it owes a commission
 * to. Maps to the Ledger's tuple COMMISSION_SPLIT · COMMISSION_PAYABLE · SETTLES · CASH_OUT, the same
 * position an obligation recognized with kind "commission" opened. The amount is whatever the user
 * states: the Ledger records it and calculates no percentage (REQ-257).
 */
export const registerCommissionPayment: Scenario = {
  id: "register_commission_payment",
  title: "Register commission pass-through",
  description: "Record a commission pass-through leaving the usina's account (cash out).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Who received the pass-through?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What amount was paid?", required: true },
    CURRENCY_SLOT,
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date did the money leave the account?", required: true },
    // Optional continuity: the commission obligation this payment closes, when it was opened beforehand.
    { key: "objectRef", type: SlotType.STRING, prompt: "Which commission obligation does this pay?", required: false },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  // Only words no other scenario uses: the free-text classifier scores what is distinctive, and a
  // shared word such as "corretor" would stop pointing at the scenario that owned it.
  keywords: { "pt-BR": ["repasse", "repasses", "repassar"] },
};
