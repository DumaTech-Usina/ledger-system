import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register commission waiver" — the usina discharges a broker's commission entitlement, NO cash
 * moves. Maps to the Ledger's ratified tuple COMMISSION_WAIVER · COMMISSION_ENTITLEMENT ·
 * {SETTLES|REVERSES} · NON_CASH · COMMISSION_WAIVER. The `basis` slot selects a standard waiver
 * (SETTLES) or reversing an incorrectly granted entitlement (REVERSES). No party carries an amount
 * (non-cash); the broker is the single BENEFICIARY party. English here is the fallback; pt-BR is in
 * the i18n catalog.
 */
export const registerWaiver: Scenario = {
  id: "register_waiver",
  title: "Register commission waiver",
  description: "Record a commission waiver — the usina gives up a broker's commission entitlement (no cash moves).",
  slots: [
    { key: "payee", type: SlotType.PARTY, prompt: "Whose commission is being waived (broker or partner)?", required: true, suggestionSource: "parties" },
    { key: "basis", type: SlotType.CHOICE, prompt: "Is this a standard waiver, or reversing an incorrectly granted entitlement?", required: true, choices: ["waiver", "reversal"] },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the waived amount?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it waived?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["renuncia", "renunciar", "isencao", "perdao"] },
};
