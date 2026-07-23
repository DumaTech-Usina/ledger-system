import type { SlotDefinition, SlotValue } from "../../domain/value-objects/Slot";

/**
 * A single value the extractor proposes for a slot. It is a PROPOSAL, never a decision: the
 * deterministic pipeline (ApplyAnswers → DialogEngine) validates and merges it, and the Ledger
 * remains the sole authority over the eventual candidate. `confidence` is in [0, 1].
 */
export interface SlotProposal {
  key: string;
  value: SlotValue;
  confidence: number;
}

/** A scenario the extractor may classify an utterance into, with the slots it would then fill. */
export interface ScenarioCatalogEntry {
  id: string;
  title: string;
  description: string;
  slots: SlotDefinition[];
}

export interface SlotExtractionRequest {
  /** The user's free-text message. */
  utterance: string;
  /**
   * Bound mode: the slots of the scenario already in play — bounds what may be proposed. Provide
   * this OR `scenarios` (classify mode), not both.
   */
  slots?: SlotDefinition[];
  /**
   * Classify mode: the scenario catalog to choose from when the scenario is not yet known. The
   * extractor picks one (or asks to clarify) and proposes values for its slots in the same call.
   */
  scenarios?: ScenarioCatalogEntry[];
  /** Answers already recorded on the intent (context; a proposer may use them or ignore them). */
  priorAnswers?: Record<string, SlotValue>;
  /** Known parties for grounding PARTY mentions to a real id. Absent = no grounding available. */
  knownParties?: { partyId: string; name: string }[];
}

export interface SlotExtractionResult {
  /**
   * Classify mode only: the best-guess scenario id. Absent when the guess is ambiguous/none (see
   * `clarification`) or in bound mode. Only ids present in the supplied catalog are valid.
   */
  scenarioId?: string;
  /** Classify mode only: a question to ask when no scenario could be confidently chosen. */
  clarification?: string;
  /** Proposed values, each with a confidence. May be empty. Only keys of the in-play scenario are valid. */
  slots: SlotProposal[];
}

/**
 * The boundary behind which any natural-language extraction lives — the one non-deterministic step.
 * The domain and application layers depend only on this interface, never on a model or provider, so
 * a deterministic stub and a real model are interchangeable (mirrors CandidateSubmissionPort).
 *
 * Contract every adapter must honour:
 *  - propose only keys that appear in `request.slots`;
 *  - never throw (return an empty result on an unparseable/empty utterance);
 *  - propose values only — never a candidate, an economic tuple, or a lineage link.
 */
export interface SlotExtractionPort {
  extract(request: SlotExtractionRequest): Promise<SlotExtractionResult>;
}
