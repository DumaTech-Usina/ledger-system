import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Register advance recovery" — the usina recovers an advance (cash in), SETTLING the advance an
 * ADVANCE_PAYMENT originated. Maps to the Ledger's ratified tuple ADVANCE_SETTLEMENT · ADVANCE ·
 * SETTLES · CASH_IN · ADVANCE_PAYMENT, linking back to the originating advance via `origin`.
 *
 * The origin is REQUIRED: the Ledger does not admit an orphan advance settlement — you cannot settle
 * an advance you cannot identify. A wrong or non-existent reference drives a re-ask. English is the
 * fallback; pt-BR is in the i18n catalog.
 */
export const registerAdvanceSettlement: Scenario = {
  id: "register_advance_settlement",
  title: "Register advance recovery",
  description: "Record recovery of an advance the usina disbursed (cash in), settling the originating advance.",
  slots: [
    { key: "payer", type: SlotType.PARTY, prompt: "Who is repaying the advance (broker or partner)?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What amount was recovered?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it recovered?", required: true },
    { key: "origin", type: SlotType.EVENT_REF, prompt: "Which advance does this settle?", required: true, suggestionSource: "origin_events" },
    // Optional continuity assertion: the id of the advance position this recovery moves, so the
    // Ledger projects ONE advance being settled rather than a new object per event. Never required —
    // absence is a legitimate state (the position may simply be unknown), and it changes nothing.
    { key: "objectRef", type: SlotType.STRING, prompt: "If you know it, the id of the advance being settled (optional).", required: false },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: { "pt-BR": ["recuperacao", "recuperar", "recuperado"] },
};
