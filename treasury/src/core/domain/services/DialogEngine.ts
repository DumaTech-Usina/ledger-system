import type { Scenario } from "../scenarios/Scenario";
import type { SlotDefinition, SlotValue } from "../value-objects/Slot";
import { SlotType } from "../enums/SlotType";

export type DialogState =
  | { kind: "question"; slot: SlotDefinition; answered: number; total: number }
  | { kind: "ready"; answered: number; total: number };

export interface SlotValidationError {
  key: string;
  message: string;
}

const isBlank = (v: SlotValue | undefined): boolean => v === undefined || v.trim() === "";

/**
 * Pure, deterministic conversation engine — the heart of the guided (non-form) experience.
 * No LLM: given a scenario and the answers so far, it decides the next question or signals
 * readiness, and validates a single answer. Kept side-effect free so it is trivially testable
 * and identical everywhere it runs.
 */
export const DialogEngine = {
  /** The next required slot to ask, then the optional description, or `ready` once both are settled. */
  nextState(scenario: Scenario, answers: Record<string, SlotValue>): DialogState {
    const total = scenario.slots.length;
    const answered = scenario.slots.filter((s) => !isBlank(answers[s.key])).length;

    const nextRequired = scenario.slots.find((s) => s.required && isBlank(answers[s.key]));
    if (nextRequired) return { kind: "question", slot: nextRequired, answered, total };

    // Once every required slot is filled, offer the one optional slot meant to be asked.
    // Presence in `answers` — not blankness — is what marks it as already asked: a skip
    // records "" against the key, and checking isBlank here would re-offer it forever.
    const description = scenario.slots.find((s) => s.key === "description" && !(s.key in answers));
    if (description) return { kind: "question", slot: description, answered, total };

    return { kind: "ready", answered, total };
  },

  /** Validate one answer against its slot. Returns null when valid. */
  validateAnswer(slot: SlotDefinition, value: SlotValue): SlotValidationError | null {
    if (slot.required && isBlank(value)) {
      return { key: slot.key, message: `${slot.prompt} is required.` };
    }
    if (isBlank(value)) return null; // optional + blank is fine

    switch (slot.type) {
      case SlotType.MONEY:
        if (!/^\d+(\.\d{1,2})?$/.test(value)) {
          return { key: slot.key, message: "Enter a valid amount, e.g. 1500.00." };
        }
        if (Number(value) <= 0) {
          return { key: slot.key, message: "Amount must be greater than zero." };
        }
        break;
      case SlotType.DATE:
        if (Number.isNaN(Date.parse(value))) {
          return { key: slot.key, message: "Enter a valid date." };
        }
        break;
      case SlotType.CHOICE:
        if (slot.choices && !slot.choices.includes(value)) {
          return { key: slot.key, message: `Choose one of: ${slot.choices.join(", ")}.` };
        }
        break;
    }
    return null;
  },
};
