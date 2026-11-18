import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";
import { CURRENCY_SLOT } from "../value-objects/Slot";

/**
 * "Compensate" (§4.5, §8.11, REQ-250, REQ-693) — what a party owes the Usina (an advance or a loan) and
 * what the Usina owes it (a commission obligation) go down by the same amount, in one event, with no
 * cash. Maps to the Ledger's COMPENSATION · {COMMISSION_PAYABLE, ADVANCE | LOAN} · SETTLES · NON_CASH ·
 * COMPENSATION.
 *
 * Registered only from the party's page, where the pair is chosen (`conversational: false`): a pair
 * of positions is not something a conversation can ask for one question at a time. Exactly one
 * position per side (REQ-693) — the use case that drives this scenario checks it before anything is
 * sent. English is the fallback; pt-BR is in the client catalog.
 */
export const registerCompensation: Scenario = {
  id: "register_compensation",
  title: "Compensate",
  description:
    "What a party owes the usina and what the usina owes it go down by the same amount, with no cash (one advance or loan against one commission obligation).",
  conversational: false,
  slots: [
    // The commission obligation: the position the operation is opened from.
    { key: "objectRef", type: SlotType.STRING, prompt: "The obligation the compensation settles.", required: true },
    // The other side, as JSON `[{ objectId, objectType }]`: the advance or the loan.
    { key: "otherPositions", type: SlotType.STRING, prompt: "What the party owes the usina, compensated against it.", required: true },
    { key: "payee", type: SlotType.PARTY, prompt: "With whom is the compensation?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "How much goes down on each side?", required: true },
    CURRENCY_SLOT,
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was the compensation agreed?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
