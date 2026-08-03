import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Rectify an entry" — declares that a previously recorded event never corresponded to the world.
 * Maps to the Ledger's ratified tuple LEDGER_CORRECTION · <object> · RETRACTS · NON_CASH ·
 * DATA_RECONCILIATION, naming the corrected event through `target`.
 *
 * Use it only when the fact never happened (a keying error verified against a source document).
 * When a fact DID happen and was later undone, the operation is a reversal, not a rectification.
 *
 * Every slot other than `target` and `description` is filled from the Ledger's own record of the
 * corrected event: the amount and the object come from what is stored, never from a second typing,
 * so a correction cannot disagree with what it corrects. English is the fallback; pt-BR is in the
 * i18n catalog.
 */
export const registerRectification: Scenario = {
  id: "register_rectification",
  title: "Rectify a recorded entry",
  description:
    "Declare that an entry already recorded never happened — a keying error confirmed against the source. The correct value, if there is one, is recorded afterwards as its own entry.",
  slots: [
    { key: "target", type: SlotType.EVENT_REF, prompt: "Which entry never happened?", required: true, suggestionSource: "origin_events" },
    // Derived from the corrected event; declared so the deterministic merge accepts them.
    { key: "objectRef", type: SlotType.STRING, prompt: "The position the corrected entry moved.", required: true },
    { key: "objectType", type: SlotType.CHOICE, prompt: "The kind of position the corrected entry moved.", required: true, choices: ["advance", "loan", "commission_receivable"] },
    { key: "amount", type: SlotType.MONEY, prompt: "The amount the corrected entry asserted.", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was the error established?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "What established the error (document, reconciliation)?", required: false },
  ],
  keywords: { "pt-BR": ["retificar", "retificacao", "corrigir", "estava errado"] },
};
