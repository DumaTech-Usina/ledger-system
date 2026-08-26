import { apiGet, apiPost, apiPostForm } from "@/api/client";
import type {
  AdvanceDialogResult,
  ApplyAnswersResult,
  ApplyMode,
  DecideIdentityResult,
  ExtractAndApplyDocumentResult,
  GetIntentResult,
  IdentityDecisionKind,
  IntentSummary,
  InterpretResult,
  PreviewIntentResult,
  ScenarioSummary,
  SettlementCandidatesResult,
  StartIntentResult,
  SubmitIntentResult,
  PositionActionsResult,
  StartPositionActionResult,
  RectifyResult,
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
  /**
   * An attached file, sent instead of a typed answer — extracted fields fill whatever unanswered
   * slots they match, through the same batch merge `applyAnswers` uses under the hood. A dropped
   * file bypasses the composer's own `accept` filter entirely, so an unsupported format reaching
   * this route is the ordinary case to handle, not an edge case: the multer layer answers it with
   * 400 and this same error body, never a thrown exception.
   */
  extract: (intentId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiPostForm<ExtractAndApplyDocumentResult | ApiErrorBody>(`/api/conversation/${intentId}/extract`, form);
  },
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
  rectify: (input: {
    targetEventId: string;
    description?: string;
    /**
     * Present when the entry happened but was mis-measured. Two facts are then recorded — the
     * withdrawal and the corrected entry — never an edit. Only the fields a correction may restate
     * are sent; the rest is carried over from what the Ledger holds.
     */
    corrected?: { amount?: string; occurredAt?: string };
  }) => apiPost<RectifyResult | ApiErrorBody>("/api/conversation/rectify", input),

  /**
   * What can be recorded about a position. Derived server-side from the Ledger's algebra crossed
   * with what treasury can produce — never a list kept here, which is how the old hardcoded set of
   * rectifiable kinds came to drift from the backend that owned it.
   */
  positionActions: (objectId: string) =>
    apiGet<PositionActionsResult>(`/api/conversation/positions/${encodeURIComponent(objectId)}/actions`),

  /** Opens a conversation already bound to this position, on the action the operator chose. */
  startPositionAction: (objectId: string, scenarioId: string, variantChoice?: string) =>
    apiPost<StartPositionActionResult | ApiErrorBody>(
      `/api/conversation/positions/${encodeURIComponent(objectId)}/start`,
      { scenarioId, variantChoice },
    ),
};
