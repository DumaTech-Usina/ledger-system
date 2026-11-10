/**
 * What an external system said, kept as it came (REQ-260). It is not a fact and never goes to the
 * Ledger: the facts are the intents it proposes, each confirmed on its own (REQ-261).
 *
 * Immutable. A later reading of the same record is a new signal, never an edit of this one
 * (REQ-266). What happened to each proposal since is read from the intent, not stored here.
 */

export type SignalSystem = "insurance";
export type SignalKind = "policy" | "eligibility";
export type ProposedFactKind = "commission_expected" | "commission_obligation";

export interface ProposedFact {
  fact: ProposedFactKind;
  sourceReference: string;
  intentId: string;
  /** True when an earlier reading had already proposed this fact and its intent was pointed at. */
  reused: boolean;
  /** How the party the fact needs was found, at the time of this reading (REQ-267). */
  party?: PartyOutcome;
}

/**
 * - `linked`: one party already carries the source's id (directly or through a curator's link).
 * - `provisional`: nobody did; a provisional identity was created with that id (REQ-324).
 * - `ambiguous`: more than one party carries it; nothing is chosen and the user is asked.
 * - `not_informed`: the signal brought no id; the user is asked. A name alone never links.
 */
export type PartyOutcome =
  | { outcome: "linked"; partyId: string }
  | { outcome: "provisional"; partyId: string }
  | { outcome: "ambiguous"; candidates: string[] }
  | { outcome: "not_informed" };

export interface ExternalSignalProps {
  id: string;
  system: SignalSystem;
  kind: SignalKind;
  /** The record's id in the source system: the policy. */
  recordId: string;
  fields: Record<string, string>;
  /** SHA-256 of the kind and fields, so the same reading can be told apart from a changed one. */
  contentHash: string;
  receivedAt: string;
  /** Who brought it in. Without an API, the user who copied it from the source's screen. */
  recordedBy: string;
  proposals: ProposedFact[];
}

export class ExternalSignal {
  private constructor(private readonly props: ExternalSignalProps) {}

  static record(props: ExternalSignalProps): ExternalSignal {
    return new ExternalSignal(clone(props));
  }

  static rehydrate(props: ExternalSignalProps): ExternalSignal {
    return new ExternalSignal(clone(props));
  }

  get id(): string { return this.props.id; }
  get kind(): SignalKind { return this.props.kind; }
  get recordId(): string { return this.props.recordId; }
  get receivedAt(): string { return this.props.receivedAt; }

  toJSON(): ExternalSignalProps {
    return clone(this.props);
  }
}

const clone = (p: ExternalSignalProps): ExternalSignalProps => ({
  ...p,
  fields: { ...p.fields },
  proposals: p.proposals.map((x) => ({
    ...x,
    ...(x.party ? { party: { ...x.party, ...("candidates" in x.party ? { candidates: [...x.party.candidates] } : {}) } } : {}),
  })),
});
