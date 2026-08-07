export type SlotType = "string" | "money" | "date" | "choice" | "party" | "event_ref";

export interface SlotDefinition {
  key: string;
  type: SlotType;
  prompt: string;
  required: boolean;
  help?: string;
  choices?: string[];
  suggestionSource?: string;
  /**
   * PARTY slots only: whether this counterparty may be recorded as explicitly not identifiable.
   * Absent means NOT admissible — the option is never offered as a global escape.
   */
  allowUnidentifiable?: boolean;
}

export type DialogState =
  | { kind: "question"; slot: SlotDefinition; answered: number; total: number }
  | { kind: "ready"; answered: number; total: number };

export interface SlotValidationError {
  key: string;
  message: string;
}

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
}

export interface StartIntentResult {
  intentId: string;
  scenario: ScenarioSummary;
  state: DialogState;
}

/** The raw text the user used to refer to a counterparty. A mention is not an identity. */
export interface Mention {
  text: string;
  normalized: string;
}

/** Which rung of the backend's resolution cascade produced the answer. */
export type ResolutionRule =
  | "exact_id"
  | "exact_document"
  | "exact_external_id"
  | "exact_name"
  | "similarity";

export interface ResolutionCandidate {
  partyId: string;
  displayName: string;
  /** In [0, 1]. */
  score: number;
}

/**
 * How a mention resolved against the Party Directory. `resolved` with `needsConfirmation` is a
 * similarity hit, not an equality one — the backend does NOT record it, so the conversation has to
 * ask before it can be used. `ambiguous` and `new` are likewise not recorded: the slot stays blank
 * and is asked again until an identity decision settles it.
 */
export type Resolution =
  | {
      kind: "resolved";
      mention: Mention;
      partyId: string;
      rule: ResolutionRule;
      score: number;
      needsConfirmation: boolean;
    }
  | { kind: "ambiguous"; mention: Mention; candidates: ResolutionCandidate[] }
  | { kind: "new"; mention: Mention };

/** What one turn did with one PARTY slot. Reported alongside the dialog state, never inside it. */
export interface IdentityOutcome {
  slot: string;
  resolution: Resolution;
}

/** The two acts that may bring a PartyId into existence from a conversation. */
export type IdentityDecisionKind = "create" | "unidentifiable";

export interface AdvanceDialogResult {
  state: DialogState;
  error?: SlotValidationError;
  /**
   * Present when the answer named a PARTY. When it did not resolve to exactly one known party the
   * slot is left unfilled — so `state` simply asks again — and this carries what the conversation
   * needs to offer a decision.
   */
  identity?: IdentityOutcome;
}

/** The record of an act that brought a PartyId into existence, with its author and moment. */
export interface IdentityDecision {
  kind: IdentityDecisionKind;
  partyId: string;
  mention: string;
  slot: string;
  justification?: string;
  decidedBy: string;
  decidedAt: string;
  intentId: string;
}

export interface DecideIdentityResult {
  decision: IdentityDecision;
  state: DialogState;
}

export interface SlotProposal {
  key: string;
  value: string;
  confidence: number;
}

export interface InterpretResult {
  /** Present once an intent exists (continued, or created after classification). */
  intentId?: string;
  /** The scenario in play (bound, or the one classified from the utterance). */
  scenarioId?: string;
  /** The next dialog state — present whenever an intent exists. */
  state?: DialogState;
  /** A question to resolve which operation the user means — present when no scenario was resolved. */
  clarification?: string;
  /** Keys that were extracted with enough confidence and successfully recorded. */
  accepted: string[];
  /** Proposals that failed validation (or named an unknown slot) — never recorded. */
  rejected: SlotValidationError[];
  /** Keys skipped because the slot was already filled (fill-only overwrite policy). */
  skipped: string[];
  /** Proposals below the confidence threshold — not applied; surfaced for a later confirm step. */
  lowConfidence: SlotProposal[];
  /** How each proposed PARTY mention resolved. An unresolved one is not recorded. */
  identity: IdentityOutcome[];
}

export interface CandidateParty {
  partyId: string;
  role: string;
  direction: string;
  amount?: string;
}

export interface CandidateObject {
  objectId: string;
  objectType: string;
  relation: string;
}

export interface Candidate {
  sourceReference: string;
  eventType: string;
  economicEffect: string;
  occurredAt: string;
  amount: string;
  currency: string;
  description?: string;
  parties: CandidateParty[];
  objects: CandidateObject[];
  reason: { type: string; description: string; confidence: string; requiresFollowup: boolean };
  reporter: { reporterType: string; reporterId: string; channel: string };
}

/** One optional question, offered after the intent is already complete. Never blocks the submit. */
export interface EnrichmentSuggestion {
  partyId: string;
  displayName: string;
  attribute: string;
}

export interface PreviewIntentResult {
  intentId: string;
  scenarioTitle: string;
  answers: Record<string, string>;
  candidate: Candidate;
  /**
   * partyId → display name, for the confirmation card. A party the Directory does not know is
   * absent here and keeps its id on screen — unknown is shown as unknown, never given a label.
   */
  partyNames: Record<string, string>;
  /** Present when exactly one party in this candidate is worth one question. */
  enrichment?: EnrichmentSuggestion;
}

export type SubmissionStatus = "accepted" | "rejected";

/**
 * Disposition of a rejection — the only thing the conversation branches on. `input`/`lineage` are
 * fixable (re-ask the implicated slot); `duplicate`/`internal` are terminal.
 */
export type RejectionCategory = "input" | "lineage" | "duplicate" | "internal";

/** One structured rejection. `code` is the Ledger's stable domain vocabulary, treated as opaque. */
export interface RejectionDetail {
  code: string;
  category: RejectionCategory;
  field?: string;
  detail: string;
  hint?: Record<string, string>;
}

export interface SubmitIntentResult {
  intentId: string;
  /** Raw Ledger disposition. */
  status: SubmissionStatus;
  /** Resulting intent lifecycle status — this, not `status`, is what the conversation branches on. */
  intentStatus: IntentStatus;
  ledgerReference?: string;
  reason?: string;
  /** Present when rejected. */
  rejections?: RejectionDetail[];
  /** When intentStatus is `awaiting_correction` — the scenario slot keys the user should re-answer. */
  correction?: { slots: string[] };
  candidate: Candidate;
}

/**
 * What a correction produced. A withdrawal alone yields `retraction` only; a restatement yields both.
 *
 * The three other fields are the honest failures, and each says something different:
 * `notReissuable` — nothing was written, because the entry cannot be recorded again;
 * `reissueIncomplete` — the withdrawal stands and the corrected entry could not be described from
 * the record alone, so the correction is HALF DONE and the position will say so;
 * a `retraction` that was not accepted — nothing else was attempted.
 */
export interface RectifyResult {
  retraction?: SubmitIntentResult;
  reissue?: SubmitIntentResult;
  notReissuable?: "no_scenario" | "ambiguous_variant" | "is_a_correction";
  reissueIncomplete?: { missingSlot: string };
}

/** One thing the operator can record about a position, derived from the Ledger's own algebra. */
export interface PositionAction {
  scenarioId: string;
  eventType: string;
  relation: string;
  variantChoice?: string;
  /**
   * True when recording this ALSO touches a position other than this one — a commission split
   * settles nothing here, it opens what the usina now owes a partner. The screen has to say which
   * of the two is happening instead of presenting both as "evolving this position".
   */
  touchesOtherPositions: boolean;
  /** Orders the list. An action is never hidden for being unlikely — the Ledger decides validity. */
  likely: boolean;
}

export interface PositionActionsResult {
  objectId: string;
  objectType: string;
  /** False when the algebra does not declare this kind — unknown, not "nothing allowed". */
  known: boolean;
  actions: PositionAction[];
}

/** A conversation opened from a position, already knowing what the position could answer. */
export interface StartPositionActionResult {
  intentId: string;
  state: DialogState;
  /** The answer keys the position supplied, so the screen can show what it already knows. */
  prefilled: string[];
}

export type IntentStatus =
  | "draft"
  | "gathering"
  | "awaiting_confirmation"
  | "confirmed"
  | "submitted"
  /** The Ledger rejected for a fixable reason. Not terminal: edit the implicated slots and resubmit. */
  | "awaiting_correction"
  | "accepted"
  | "rejected";

export interface IntentProps {
  id: string;
  scenarioId: string;
  userId: string;
  status: IntentStatus;
  answers: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  ledgerReference?: string;
  rejectionReason?: string;
}

export interface AuditEntry {
  id: string;
  intentId: string;
  at: string;
  type: string;
  detail?: string;
}

export interface GetIntentResult {
  intent: IntentProps;
  scenarioTitle: string;
  history: AuditEntry[];
}

/**
 * One position a settlement could be about. Selecting it asserts two things at once: which position
 * the fact moves (continuity) and which fact caused it (lineage) — one business question, two
 * fields the user never has to know exist.
 */
export interface SettlementCandidate {
  objectId: string;
  /** Null when the Ledger holds no origination, so this position cannot supply lineage. */
  originEventId: string | null;
  /** The Directory's name, the raw id when it has none, or null when there is no origin at all. */
  counterparty: string | null;
  totalOriginated: string;
  /** Present only when it differs from what was originated — i.e. already partly settled. */
  openBalance: string | null;
  currency: string;
  originatedAt: string | null;
}

export interface SettlementCandidatesResult {
  /** The answer keys a selection fills. Empty when the scenario admits no continuity. */
  slots: { continuity?: string; lineage?: string };
  candidates: SettlementCandidate[];
}

/** The workspace list row for one intent. */
export interface IntentSummary {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  status: IntentStatus;
  updatedAt: string;
}

/**
 * How a batch of answers treats slots that are already filled. `fill` only fills empty ones;
 * `edit` overwrites and re-validates.
 */
export type ApplyMode = "fill" | "edit";

export interface ApplyAnswersResult {
  state: DialogState;
  /** Answers that failed validation (or named an unknown slot). Never recorded. */
  rejected: SlotValidationError[];
  /** Keys skipped because the slot was already filled and mode is `fill`. */
  skipped: string[];
  /** One entry per PARTY answer processed this turn. */
  identity: IdentityOutcome[];
}
