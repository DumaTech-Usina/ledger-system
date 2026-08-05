import { apiGet, apiPost } from "@/api/client";
import type {
  AdvanceDialogResult,
  ApplyAnswersResult,
  ApplyMode,
  DecideIdentityResult,
  GetIntentResult,
  IdentityDecisionKind,
  IntentSummary,
  InterpretResult,
  PreviewIntentResult,
  ScenarioSummary,
  SettlementCandidatesResult,
  StartIntentResult,
  SubmitIntentResult,
} from "@/types/operations";

/** The identity route answers a refused decision with 422 and this body — the user's to fix. */
interface ApiErrorBody {
  error: string;
}

export const operationsApi = {
  scenarios: () => apiGet<{ scenarios: ScenarioSummary[] }>("/api/conversation/scenarios"),
  start: (scenarioId: string) => apiPost<StartIntentResult>("/api/conversation/start", { scenarioId }),
  answer: (intentId: string, key: string, value: string) =>
    apiPost<AdvanceDialogResult>(`/api/conversation/${intentId}/answer`, { key, value }),
  /** The batch merge — one round-trip that validates every answer and reports all the problems. */
  applyAnswers: (intentId: string, answers: { key: string; value: string }[], mode: ApplyMode) =>
    apiPost<ApplyAnswersResult>(`/api/conversation/${intentId}/apply`, { answers, mode }),
  preview: (intentId: string) => apiGet<PreviewIntentResult>(`/api/conversation/${intentId}/preview`),
  submit: (intentId: string) => apiPost<SubmitIntentResult>(`/api/conversation/${intentId}/submit`, {}),
  getIntent: (intentId: string) => apiGet<GetIntentResult>(`/api/intents/${intentId}`),
  /** The positions this settlement could be about. An empty list means: don't ask, just prompt. */
  settlementCandidates: (intentId: string) =>
    apiGet<SettlementCandidatesResult>(`/api/conversation/${intentId}/candidates`),
  listIntents: () => apiGet<{ intents: IntentSummary[] }>("/api/intents"),
  /** No scenario chosen yet: classify from free text, create the intent, and merge whatever it extracts. */
  interpretNew: (utterance: string) => apiPost<InterpretResult>("/api/conversation/interpret", { utterance }),
  /** Continue an existing intent from free text (scenario already bound). */
  interpretBound: (intentId: string, utterance: string) =>
    apiPost<InterpretResult>(`/api/conversation/${intentId}/interpret`, { utterance }),
  /**
   * Creates an identity, or declares one cannot be identified. Deliberately its own route, not
   * another way to answer the slot: it is the only conversational path that mints a PartyId.
   * Choosing a party that already exists does NOT come through here — it is an ordinary `answer`
   * carrying the canonical PartyId.
   */
  decideIdentity: (
    intentId: string,
    input: { slot: string; kind: IdentityDecisionKind; mention: string; justification?: string },
  ) => apiPost<DecideIdentityResult | ApiErrorBody>(`/api/conversation/${intentId}/identity`, input),
  /**
   * Answers the one optional enrichment question — or records that the user would not. An omitted
   * value is the refusal, stored as its own state so the question is never asked again.
   */
  enrich: (intentId: string, input: { partyId: string; key: string; value?: string }) =>
    apiPost<{ partyId: string } | ApiErrorBody>(`/api/conversation/${intentId}/enrich`, input),
  /**
   * Declares that a recorded entry never corresponded to the world. Not a guided conversation: the
   * operator points at the entry, and the amount and object are read from the Ledger's own record
   * of it — so a correction can never disagree with what it corrects.
   */
  rectify: (input: { targetEventId: string; description?: string }) =>
    apiPost<SubmitIntentResult | ApiErrorBody>("/api/conversation/rectify", input),
};
