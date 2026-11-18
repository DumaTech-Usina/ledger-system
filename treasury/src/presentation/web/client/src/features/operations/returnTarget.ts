import type { Phase } from "@/features/operations/conversationEngine";

/**
 * REQ-690: where a conversation opened from a screen goes back to.
 *
 * The screen the operator came from — an agenda, Positions — stays mounted (hidden) while the
 * conversation runs, so going back finds it as it was left: the same window, filters, page and ticks.
 * This only names it and the conversation it is waiting on.
 */
export interface ReturnTarget {
  /** The navigation id of the screen to go back to. */
  nav: string;
  /** The conversation that screen opened. Any other conversation is not its business. */
  intentId: string;
}

/**
 * How the way back is offered:
 *
 * - `primary` once the conversation has ended — sent and accepted, refused for good, or given up
 *   (Cancelar brings the picker back with no intent). Going back is then the obvious next step.
 * - `secondary` while it is still running: the way back is there, but the operation is the point.
 * - `none` when there is nowhere to go back to, or the operator has moved on to a conversation of
 *   their own — offering to go back to the agenda from an unrelated operation would be noise.
 */
export type ReturnOffer = "primary" | "secondary" | "none";

export function returnOffer(
  target: ReturnTarget | null | undefined,
  conversation: {
    intentId: string | null;
    phase: Phase;
    /** The opened conversation has been on screen at least once. Before that, an empty conversation
     * is one still being taken up — not one the operator gave up. */
    seenTarget: boolean;
  },
): ReturnOffer {
  if (!target) return "none";
  if (conversation.intentId === null) {
    return conversation.seenTarget && conversation.phase === "picking" ? "primary" : "secondary";
  }
  if (conversation.intentId !== target.intentId) return "none";
  return conversation.phase === "done" ? "primary" : "secondary";
}

/** The operator started a conversation of their own: the way back no longer applies, for good. */
export function returnDiscarded(
  target: ReturnTarget | null | undefined,
  conversation: { intentId: string | null },
): boolean {
  return !!target && conversation.intentId !== null && conversation.intentId !== target.intentId;
}
