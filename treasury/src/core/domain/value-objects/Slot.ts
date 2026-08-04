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
}

export type SlotValue = string;
