import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";
import { CURRENCY_SLOT } from "../value-objects/Slot";
import { TRANSFER_FROM_SLOT, TRANSFER_TO_SLOT } from "../services/Institutions";

/**
 * "Register a transfer between institutions" (§8.8, REQ-672): money moved from one of the usina's
 * institutions to another. One fact; the usina's cash does not change, each institution's does.
 * Registered from the institutions screen (`conversational: false`).
 */
export const registerInstitutionTransfer: Scenario = {
  id: "register_institution_transfer",
  title: "Register a transfer between institutions",
  description: "Record money moved from one of the usina's institutions to another.",
  conversational: false,
  slots: [
    TRANSFER_FROM_SLOT,
    TRANSFER_TO_SLOT,
    { key: "amount", type: SlotType.MONEY, prompt: "How much was transferred?", required: true },
    CURRENCY_SLOT,
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date was it transferred?", required: true },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
};
