import { identityCopy, scenarioCopy, scenarioSlotPrompts, translateMessage } from "@/features/operations/copy";
import type {
  DialogState,
  IdentityOutcome,
  IntentStatus,
  InterpretResult,
  PreviewIntentResult,
  RejectionDetail,
  SlotDefinition,
  SettlementCandidate,
  SlotValidationError,
  SubmissionStatus,
  SubmitIntentResult,
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

/**
 * One way out of an unresolved counterparty. `select` is not a decision at all — it answers the
 * slot with the canonical PartyId, which the backend's cascade resolves by `exact_id` and records
 * like any other answer. Only `create` and `unidentifiable` mint an identity, and only those two
 * go through the identity route.
 */
export type IdentityOption =
  | { kind: "select"; partyId: string; label: string }
  | { kind: "create"; mention: string; label: string }
  | { kind: "unidentifiable"; mention: string; label: string };

export type StreamItem =
  | { id: string; kind: "bot"; text: string }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "error"; text: string }
  | { id: string; kind: "suggestion"; proposalKey: string; value: string; label: string }
  | { id: string; kind: "identity"; slot: string; text: string; options: IdentityOption[] }
  | {
      id: string;
      kind: "positions";
      /** The answer keys a selection fills — carried so the pick asserts both axes at once. */
      slots: { continuity?: string; lineage?: string };
      candidates: SettlementCandidate[];
    }
  | { id: string; kind: "confirm"; preview: PreviewIntentResult }
  | {
      id: string;
      kind: "result";
      status: SubmissionStatus;
      /** What the intent became. `awaiting_correction` is NOT an ending — the chat re-asks. */
      intentStatus: IntentStatus;
      ledgerReference?: string;
      reason?: string;
      rejections?: RejectionDetail[];
      /** Present when correctable: the scenario slots the Ledger's complaint maps back to. */
      correctionSlots?: string[];
    }
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

/**
 * What to offer for a PARTY answer the Directory could not turn into exactly one known party.
 *
 * Returns null when there is nothing to ask: an exact resolution is already recorded, so the dialog
 * simply moves on. Every other outcome left the slot blank on purpose — the backend records nothing
 * it cannot identify — and this is what the conversation says instead of repeating the question.
 *
 * `allowUnidentifiable` is read from the slot, and an absent slot yields the conservative answer:
 * the option is not offered. That mirrors the backend, where an absent flag means not admissible.
 */
export function identityDecision(outcome: IdentityOutcome, slot: SlotDefinition | undefined): NewMessage | null {
  const { resolution } = outcome;
  if (resolution.kind === "resolved" && !resolution.needsConfirmation) return null;

  const mention = resolution.mention.text;
  const options: IdentityOption[] = [];
  let text: string;

  if (resolution.kind === "resolved") {
    // A similarity hit. The backend refuses to record it, and picking it silently is how two real
    // counterparties become one aggregate — irreversibly, since events are immutable.
    text = identityCopy.confirm(mention, resolution.partyId);
    options.push({ kind: "select", partyId: resolution.partyId, label: resolution.partyId });
  } else if (resolution.kind === "ambiguous") {
    text = identityCopy.ambiguous(mention);
    for (const candidate of resolution.candidates) {
      options.push({ kind: "select", partyId: candidate.partyId, label: candidate.displayName });
    }
  } else {
    text = identityCopy.unknown(mention);
  }

  options.push({ kind: "create", mention, label: identityCopy.create(mention) });
  if (slot?.allowUnidentifiable) {
    options.push({ kind: "unidentifiable", mention, label: identityCopy.unidentifiable });
  }

  return { kind: "identity", slot: outcome.slot, text, options };
}

/**
 * The one identity question a turn is worth asking, or null. At most one: a batch of proposals can
 * carry several unresolved mentions, and asking them all at once turns a conversation into a form.
 */
export function pendingIdentity(
  outcomes: IdentityOutcome[] | undefined,
  slotsByKey: Record<string, SlotDefinition>,
): NewMessage | null {
  for (const outcome of outcomes ?? []) {
    const message = identityDecision(outcome, slotsByKey[outcome.slot]);
    if (message) return message;
  }
  return null;
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

/**
 * Which of the offered positions can actually answer the question on screen.
 *
 * A settlement whose origin the Ledger requires cannot be answered by a position the Ledger never
 * recorded an origination for — selecting it would leave the required question unanswered and the
 * conversation would simply ask again. Offering only what can answer is the difference between a
 * shortcut and a trap.
 *
 * An empty result is the ordinary case and means: say nothing, let the composer ask as always.
 */
export function offerablePositions(
  candidates: SettlementCandidate[],
  slot: SlotDefinition | null,
): SettlementCandidate[] {
  if (!slot || slot.type !== "event_ref") return [];
  return slot.required ? candidates.filter((c) => c.originEventId !== null) : candidates;
}

/**
 * The answers a selection asserts. Continuity always; lineage only when the position has an origin
 * to point at. Never invents either — a key with nothing behind it is simply not sent.
 */
export function positionAnswers(
  candidate: SettlementCandidate,
  slots: { continuity?: string; lineage?: string },
): { key: string; value: string }[] {
  const answers: { key: string; value: string }[] = [];
  if (slots.lineage && candidate.originEventId) {
    answers.push({ key: slots.lineage, value: candidate.originEventId });
  }
  if (slots.continuity) {
    answers.push({ key: slots.continuity, value: candidate.objectId });
  }
  return answers;
}

export interface SubmitDecision {
  /** True when this conversation has nothing left to do with the intent. */
  terminal: boolean;
  message: NewMessage;
}

/**
 * What the Ledger's answer means for the conversation.
 *
 * The branch is `intentStatus`, never `status`: a rejection the Ledger classified as fixable comes
 * back with `status: "rejected"` too, and reading only that would end a conversation that is
 * supposed to continue — the intent is still alive and the same one can carry the correction.
 */
export function decideSubmitOutcome(result: SubmitIntentResult): SubmitDecision {
  const base = {
    kind: "result" as const,
    status: result.status,
    intentStatus: result.intentStatus,
    ledgerReference: result.ledgerReference,
    reason: result.reason,
    rejections: result.rejections,
  };

  if (result.intentStatus === "awaiting_correction") {
    return { terminal: false, message: { ...base, correctionSlots: result.correction?.slots ?? [] } };
  }
  return { terminal: true, message: base };
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
