import { scenarioCopy, scenarioSlotPrompts, translateMessage } from "@/features/operations/copy";
import type {
  DialogState,
  InterpretResult,
  PreviewIntentResult,
  SlotDefinition,
  SlotValidationError,
  SubmissionStatus,
} from "@/types/operations";

/**
 * The conversation's pure decision layer — the frontend analog of the backend's DialogEngine
 * (see treasury/src/core/domain/services/DialogEngine.ts): given the current facts, decide what
 * should happen next. No React, no fetch, no `Date.now`-style hidden state — every function here
 * takes its inputs and returns its answer, nothing else. `useConversation.ts` is the only place
 * that touches the network or React state; it calls these functions to decide what to do with a
 * result, then applies the answer (pushes messages, updates state). Keeping the decisions here
 * means they're testable without mounting anything — see conversationEngine.test.ts.
 */

export type StreamItem =
  | { id: string; kind: "bot"; text: string }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "error"; text: string }
  | { id: string; kind: "suggestion"; proposalKey: string; value: string; label: string }
  | { id: string; kind: "confirm"; preview: PreviewIntentResult }
  | { id: string; kind: "result"; status: SubmissionStatus; ledgerReference?: string; reason?: string }
  | { id: string; kind: "transport-error" };

export type Phase = "picking" | "conversation" | "confirming" | "done";

/** `Omit` over a union collapses to the fields common to every member — useless for a discriminated
 * union like StreamItem. This variant distributes over each member first, so the "id"-less shape
 * still discriminates on `kind` the same way StreamItem does. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** What a decision function produces — `useConversation` stamps an `id` on each before pushing it
 * onto the visible stream (React needs a stable key; the decision itself doesn't care about one). */
export type NewMessage = DistributiveOmit<StreamItem, "id">;

export const uid = (): string => crypto.randomUUID();

/** Stamps a fresh id onto a decision's message so it can be pushed onto the visible stream. */
export function withId(message: NewMessage): StreamItem {
  return { id: uid(), ...message } as StreamItem;
}

export const slotPrompt = (scenarioId: string, slot: SlotDefinition): string =>
  scenarioSlotPrompts[scenarioId]?.[slot.key] ?? slot.prompt;

export const labelFor = (scenarioId: string, key: string): string => scenarioSlotPrompts[scenarioId]?.[key] ?? key;

export type AdvanceDecision =
  | { kind: "error"; message: NewMessage }
  | { kind: "ready" }
  | { kind: "question"; slot: SlotDefinition; message: NewMessage };

/**
 * What to do with a single-answer outcome (a direct answer, a suggestion accepted, or a bound
 * interpretation once its `interpretationMessages` are already queued): stay put with an error,
 * head to preview, or ask the next question.
 */
export function decideAdvance(
  state: DialogState,
  error: SlotValidationError | undefined,
  scenarioId: string,
): AdvanceDecision {
  if (error) {
    return { kind: "error", message: { kind: "error", text: translateMessage(error.message) } };
  }
  if (state.kind === "ready") {
    return { kind: "ready" };
  }
  return {
    kind: "question",
    slot: state.slot,
    message: { kind: "bot", text: slotPrompt(scenarioId, state.slot) },
  };
}

/** Every bubble an /interpret result is worth showing on its own — validation errors first (a
 * proposal that failed), then low-confidence suggestions (a proposal held back for confirmation).
 * Order matches how they read: "here's what went wrong" before "here's what I'm unsure about". */
export function interpretationMessages(result: InterpretResult, scenarioId: string): NewMessage[] {
  const messages: NewMessage[] = [];
  for (const err of result.rejected) {
    messages.push({ kind: "error", text: translateMessage(err.message) });
  }
  for (const proposal of result.lowConfidence) {
    messages.push({
      kind: "suggestion",
      proposalKey: proposal.key,
      value: proposal.value,
      label: labelFor(scenarioId, proposal.key),
    });
  }
  return messages;
}

/**
 * Whether a bound /interpret result found nothing usable for the question currently on screen —
 * the signal to fall back to treating the raw text as the direct answer (the old guided behaviour),
 * which is how PARTY/STRING slots and non-ISO dates still get answered.
 */
export function shouldFallbackToDirectAnswer(askedSlotKey: string | null, result: InterpretResult): boolean {
  if (!askedSlotKey) return false;
  const stillOnSameQuestion = result.state?.kind === "question";
  const extractedNothing = result.accepted.length === 0;
  return stillOnSameQuestion && extractedNothing;
}

export type ClassificationDecision =
  | { kind: "error"; message: string }
  | {
      kind: "classified";
      scenarioId: string;
      intentId: string;
      scenarioTitle: string;
      greeting: NewMessage;
    };

/**
 * What a classify-mode /interpret result (no intentId yet) means: either nothing was confidently
 * recognized — the backend's own `clarification` text is an untranslated, English list of every
 * scenario title (a stub-classifier fallback, not worth surfacing as-is), so this always returns
 * our own pt-BR message instead, with the scenario catalog already on screen to pick from — or a
 * scenario was resolved and the conversation can start.
 */
export function decideClassification(result: InterpretResult): ClassificationDecision {
  if (!result.intentId || !result.scenarioId) {
    return {
      kind: "error",
      message: "Não consegui encontrar a operação desejada. Tente descrever de outro jeito, ou escolha uma abaixo.",
    };
  }
  const copy = scenarioCopy[result.scenarioId];
  return {
    kind: "classified",
    scenarioId: result.scenarioId,
    intentId: result.intentId,
    scenarioTitle: copy?.title ?? result.scenarioId,
    greeting: { kind: "bot", text: `Vamos lá! ${copy?.description ?? ""}`.trim() },
  };
}
