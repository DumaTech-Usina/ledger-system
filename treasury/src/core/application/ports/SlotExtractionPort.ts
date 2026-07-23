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

export interface SlotExtractionRequest {
  /** The user's free-text message. */
  utterance: string;
  /** The slots of the scenario currently in play — bounds what may be proposed. */
  slots: SlotDefinition[];
  /** Answers already recorded on the intent (context; a proposer may use them or ignore them). */
  priorAnswers?: Record<string, SlotValue>;
  /** Known parties for grounding PARTY mentions to a real id. Absent = no grounding available. */
  knownParties?: { partyId: string; name: string }[];
}

export interface SlotExtractionResult {
  /** Proposed values, each with a confidence. May be empty. Only keys present in `slots` are valid. */
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
