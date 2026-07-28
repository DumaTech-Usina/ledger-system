import { apiGet, apiPost } from "@/api/client";
import type {
  AdvanceDialogResult,
  GetIntentResult,
  PreviewIntentResult,
  ScenarioSummary,
  StartIntentResult,
  SubmitIntentResult,
} from "@/types/operations";

export const operationsApi = {
  scenarios: () => apiGet<{ scenarios: ScenarioSummary[] }>("/api/conversation/scenarios"),
  start: (scenarioId: string) => apiPost<StartIntentResult>("/api/conversation/start", { scenarioId }),
  answer: (intentId: string, key: string, value: string) =>
    apiPost<AdvanceDialogResult>(`/api/conversation/${intentId}/answer`, { key, value }),
  preview: (intentId: string) => apiGet<PreviewIntentResult>(`/api/conversation/${intentId}/preview`),
  submit: (intentId: string) => apiPost<SubmitIntentResult>(`/api/conversation/${intentId}/submit`, {}),
  getIntent: (intentId: string) => apiGet<GetIntentResult>(`/api/intents/${intentId}`),
};
