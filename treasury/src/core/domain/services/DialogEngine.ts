import type { Scenario } from "../scenarios/Scenario";
import type { SlotDefinition, SlotValue } from "../value-objects/Slot";
import { SlotType } from "../enums/SlotType";
import { roundNbr5891 } from "./MoneyRounding";

export type DialogState =
  | { kind: "question"; slot: SlotDefinition; answered: number; total: number }
  | { kind: "ready"; answered: number; total: number };

export interface SlotValidationError {
  key: string;
  message: string;
  /**
   * REQ-221: the rounded amount to offer instead. Only ever offered: it is recorded if the user
   * accepts it, as an answer of its own. Absent when rounding would leave nothing above zero.
   */
  suggestedValue?: string;
}

const isBlank = (v: SlotValue | undefined): boolean => v === undefined || v.trim() === "";

/**
 * The calendar day an answer names, in this process's timezone. A bare `YYYY-MM-DD` is that day as
 * written; anything else is an instant, read locally so 02:00Z on the 4th is still the 3rd here.
 */
function dayOf(value: SlotValue): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Pure, deterministic conversation engine — the heart of the guided (non-form) experience.
 * No LLM: given a scenario and the answers so far, it decides the next question or signals
 * readiness, and validates a single answer. Kept side-effect free so it is trivially testable
 * and identical everywhere it runs.
 */
export const DialogEngine = {
  /** The next required slot to ask, or `ready` when all required slots are filled. */
  nextState(scenario: Scenario, answers: Record<string, SlotValue>): DialogState {
    const conversational = scenario.slots.filter((s) => !s.internal);
    const total = conversational.length;
    const answered = conversational.filter((s) => !isBlank(answers[s.key])).length;
    const next = scenario.slots.find((s) => s.required && isBlank(answers[s.key]));
    return next
      ? { kind: "question", slot: next, answered, total }
      : { kind: "ready", answered, total };
  },

  /**
   * Validate one answer against its slot. Returns null when valid. `today` is the current day in the
   * usina's timezone, as `YYYY-MM-DD`: a parameter so that this stays free of any clock.
   */
  validateAnswer(slot: SlotDefinition, value: SlotValue, today: string): SlotValidationError | null {
    if (slot.required && isBlank(value)) {
      return { key: slot.key, message: `${slot.prompt} is required.` };
    }
    if (isBlank(value)) return null; // optional + blank is fine

    switch (slot.type) {
      case SlotType.MONEY:
        if (/^\d+\.\d{3,}$/.test(value)) {
          const rounded = roundNbr5891(value);
          return {
            key: slot.key,
            message: "An amount has at most 2 decimal places.",
            ...(Number(rounded) > 0 ? { suggestedValue: rounded } : {}),
          };
        }
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
        if (!slot.allowFuture && dayOf(value) > today) {
          return { key: slot.key, message: "The date cannot be in the future." };
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
