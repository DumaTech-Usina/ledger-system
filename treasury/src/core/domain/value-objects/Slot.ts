import { SlotType } from "../enums/SlotType";

/**
 * A single piece of information a scenario needs, phrased as a guided question.
 * Values are stored as strings (money as a decimal string, date as ISO) to mirror the
 * Ledger's StagingRecord field shape, so mapping to a candidate is lossless.
 */
export interface SlotDefinition {
  key: string;
  type: SlotType;
  /** The guided question shown conversationally. */
  prompt: string;
  required: boolean;
  help?: string;
  /** Allowed values for CHOICE slots. */
  choices?: string[];
  /** Identifies a deterministic suggestion source (e.g. known parties from Ledger data). */
  suggestionSource?: string;
  /**
   * PARTY slots only: whether this counterparty may be recorded as explicitly not identifiable.
   * Declared per slot, so it is per scenario AND per role — the payer of an arriving payment can be
   * unknown in a way the payee of an outgoing one cannot.
   *
   * Absent means NOT admissible, mirroring how an absent `orphan` mapping makes an origin slot
   * required. The exception has to be granted somewhere explicit; it is never a global escape.
   */
  allowUnidentifiable?: boolean;
  /**
   * Filled by the system, never asked: it does not count towards the conversation's progress. An
   * internal slot that is also required must carry a `defaultValue`, or no question would ever fill it.
   */
  internal?: boolean;
  /** What the slot holds from the moment the intent starts. */
  defaultValue?: string;
  /**
   * DATE slots only: this date is not when something happened, so it may lie ahead. Absent means it
   * may not (REQ-226): a date is an occurrence unless a slot says otherwise, because a fact recorded
   * for tomorrow is a prediction, which is the worse mistake to make by omission.
   */
  allowFuture?: boolean;
}

export type SlotValue = string;

/** REQ-222: the only currency there is, until DEC-011 says otherwise. */
export const THE_CURRENCY = "BRL";

/** Every scenario's currency: already answered when the intent starts, so it is never asked. */
export const CURRENCY_SLOT: SlotDefinition = {
  key: "currency",
  type: SlotType.CHOICE,
  prompt: "Which currency?",
  required: true,
  choices: [THE_CURRENCY],
  internal: true,
  defaultValue: THE_CURRENCY,
};
