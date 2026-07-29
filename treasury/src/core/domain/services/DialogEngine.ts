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
 * Turns a "DD/MM/YYYY" or "DD-MM-YYYY" local-date shorthand into the slot's canonical "YYYY-MM-DD"
 * ISO form, verifying it round-trips to a real calendar date (so "31/02/2026" is left alone rather
 * than silently rolled over to March). Anything else — already ISO, or not date-shaped at all —
 * passes through unchanged, so validateAnswer's Date.parse check is the one that judges it.
 */
export function normalizeLocalDate(value: string): string {
  const m = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return value;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const iso = `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const roundTrip = new Date(`${iso}T00:00:00.000Z`);
  const isRealDate =
    roundTrip.getUTCFullYear() === year && roundTrip.getUTCMonth() + 1 === month && roundTrip.getUTCDate() === day;
  return isRealDate ? iso : value;
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
    const total = scenario.slots.length;
    const answered = scenario.slots.filter((s) => !isBlank(answers[s.key])).length;
    const next = scenario.slots.find((s) => s.required && isBlank(answers[s.key]));
    return next
      ? { kind: "question", slot: next, answered, total }
      : { kind: "ready", answered, total };
  },

  /**
   * Normalizes a raw answer before it is validated/recorded — today only DATE accepts the common
   * DD/MM/YYYY (or DD-MM-YYYY) local shorthand alongside the canonical ISO form the slot stores;
   * every other slot type passes through unchanged.
   */
  normalizeAnswer(slot: SlotDefinition, value: SlotValue): SlotValue {
    if (isBlank(value) || slot.type !== SlotType.DATE) return value;
    return normalizeLocalDate(value);
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
