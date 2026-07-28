export type SlotType = "string" | "money" | "date" | "choice" | "party";

export interface SlotDefinition {
  key: string;
  type: SlotType;
  prompt: string;
  required: boolean;
  help?: string;
  choices?: string[];
  suggestionSource?: string;
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

export interface AdvanceDialogResult {
  state: DialogState;
  error?: SlotValidationError;
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

export interface PreviewIntentResult {
  intentId: string;
  scenarioTitle: string;
  answers: Record<string, string>;
  candidate: Candidate;
}

export type SubmissionStatus = "accepted" | "rejected";

export interface SubmitIntentResult {
  intentId: string;
  status: SubmissionStatus;
  ledgerReference?: string;
  reason?: string;
  candidate: Candidate;
}

export type IntentStatus =
  | "draft"
  | "gathering"
  | "awaiting_confirmation"
  | "confirmed"
  | "submitted"
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
