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
}

export type SlotValue = string;
