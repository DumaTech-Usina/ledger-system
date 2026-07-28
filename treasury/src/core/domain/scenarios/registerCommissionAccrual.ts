import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register expected commission" — the usina accrues the commission it EXPECTS to receive, before
 * cash arrives, establishing the baseline a later commission_received reconciles against. Maps to
 * the Ledger's ratified tuple COMMISSION_EXPECTED · COMMISSION_RECEIVABLE · ORIGINATES · NON_CASH ·
 * COMMISSION_ACCRUAL. NO cash moves; the single party is the usina itself (the beneficiary of the
 * future receivable), so no counterparty is collected. English here is the fallback; pt-BR is in the
 * i18n catalog.
 */
export const registerCommissionAccrual: Scenario = {
  id: "register_commission_accrual",
  title: "Register expected commission",
  description: "Record a commission the usina expects to receive before the cash arrives (an accrual; no cash moves).",
  slots: [
    { key: "amount", type: SlotType.MONEY, prompt: "What commission amount is expected?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "As of what date is it expected?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["provisao", "prevista", "esperada"] },
};
