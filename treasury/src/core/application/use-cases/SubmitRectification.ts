import type { LedgerEventLookupPort } from "../ports/LedgerEventLookupPort";
import type { Clock } from "../ports/Clock";
import type { StartIntentUseCase } from "./StartIntent";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { SubmitIntentUseCase, SubmitIntentResult } from "./SubmitIntent";
import { planReissue } from "../services/CandidateMapper";

/** The fields a correction may restate. Anything absent is carried over from the recorded entry. */
export interface CorrectedValues {
  amount?: string;
  occurredAt?: string;
  description?: string;
}

export interface SubmitRectificationInput {
  /** The event that never happened. */
  targetEventId: string;
  userId: string;
  /** What established the error — a document, a reconciliation. Optional but strongly advised. */
  description?: string;
  /**
   * When present, the entry is not merely withdrawn: it is restated. Treasury records the retraction
   * and then records the corrected entry, on the same position.
   */
  corrected?: CorrectedValues;
}

export interface SubmitRectificationResult {
  /** Absent only when a restatement was asked for and could not be produced — nothing was written. */
  retraction?: SubmitIntentResult;
  /**
   * Absent when no restatement was asked for. Present and `status: "accepted"` when the correction
   * completed. Anything else means the correction is HALF DONE — the retraction stands and the
   * corrected entry does not — which the position surfaces until it is resumed.
   */
  reissue?: SubmitIntentResult;
  /** Why no corrected entry could be produced, when one was asked for and none was attempted. */
  notReissuable?: "no_scenario" | "ambiguous_variant" | "is_a_correction";
  /**
   * The corrected entry could not be described from the record alone — a slot the scenario requires
   * stayed blank. The commonest cause is a counterparty the Directory does not know: an unresolvable
   * party is deliberately not recorded, so the slot is left to be answered rather than guessed.
   *
   * The withdrawal already stands, so the correction is HALF DONE and the position says so until it
   * is resumed. This is the honest failure the ordering was chosen to produce.
   */
  reissueIncomplete?: { missingSlot: string };
}

/** Object kinds a rectification can name; the Ledger admits more, treasury maps these. */
const SUPPORTED_OBJECT_TYPES = new Set(["advance", "loan", "commission_receivable"]);

/**
 * Rectify a recorded entry: declare that it never corresponded to the world, and — when the entry
 * was merely mis-measured — record what actually happened.
 *
 * It orchestrates the paths that already exist: start an intent, merge answers through the same
 * deterministic validator every other operation uses, submit through the same boundary. It adds
 * exactly one thing of its own: it reads the corrected event from the Ledger and fills the answers
 * from THAT, rather than from a second typing. Amount and object therefore cannot disagree with the
 * entry being corrected — a class of error no downstream validation could catch.
 *
 * ## Why two events, and why in this order
 *
 * The Ledger has no relation that restates an amount. `ADJUSTS` closes a position rather than
 * reopening its baseline, so an advance of 400 that was really 450 cannot be "adjusted by 50": the
 * faithful sequence is to withdraw the entry and record the true one. Nothing is rewritten — the
 * 400 stays in the chain, marked retracted, and stops counting.
 *
 * There is no transaction across events, so the second submission can fail. The order is a safety
 * decision, not a convenience: retracting first leaves a book that UNDERSTATES (the position reads
 * as though nothing was originated), while reissuing first would leave both entries standing and
 * DOUBLE the figure. An understatement is visible and recoverable; a doubled figure is a false
 * number nobody notices.
 */
export class SubmitRectificationUseCase {
  constructor(
    private readonly ledgerEvents: LedgerEventLookupPort,
    private readonly startIntent: StartIntentUseCase,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly submitIntent: SubmitIntentUseCase,
    private readonly clock: Clock,
    private readonly usinaPartyId: string,
  ) {}

  async execute(input: SubmitRectificationInput): Promise<SubmitRectificationResult> {
    const target = await this.ledgerEvents.event(input.targetEventId);
    if (!target) {
      throw new Error(`Unknown entry: ${input.targetEventId}`);
    }

    // The position the entry moved. Contextual objects only annotate — they are never what a
    // rectification names, because removing the entry's contribution has nothing to do with them.
    const moved = target.objects.find((o) => o.relation !== "references");
    if (!moved) {
      throw new Error(`Entry ${input.targetEventId} moved no position, so there is nothing to rectify.`);
    }
    if (!SUPPORTED_OBJECT_TYPES.has(moved.objectType)) {
      throw new Error(`Rectifying a ${moved.objectType} entry is not supported yet.`);
    }

    // Planned BEFORE anything is written. When a restatement was asked for and treasury cannot
    // produce it, the book stays untouched: withdrawing the entry anyway would leave the operator
    // with neither the old figure nor the new one, having asked for a correction rather than a
    // withdrawal. Withdrawing alone stays available — as its own, deliberate request.
    const plan = input.corrected ? planReissue(target, this.usinaPartyId) : null;
    if (plan && !plan.reissuable) return { notReissuable: plan.reason };

    const retraction = await this.retract(input, target, moved, plan !== null);
    if (!plan || retraction.status !== "accepted") return { retraction };

    const reissue = await this.reissue(input, plan);
    return "missingSlot" in reissue
      ? { retraction, reissueIncomplete: reissue }
      : { retraction, reissue };
  }

  /** Withdraws the entry. `awaitingReissue` marks the retraction as not being the end of the story. */
  private async retract(
    input: SubmitRectificationInput,
    target: { eventId: string; amount: string; currency: string },
    moved: { objectId: string; objectType: string },
    awaitingReissue: boolean,
  ): Promise<SubmitIntentResult> {
    const { intentId } = await this.startIntent.execute({
      scenarioId: "register_rectification",
      userId: input.userId,
    });

    return this.fill(intentId, [
      { key: "target", value: target.eventId },
      { key: "objectRef", value: moved.objectId },
      { key: "objectType", value: moved.objectType },
      // The withdrawal restates what is being withdrawn — the figure as recorded, never the
      // corrected one. The new figure belongs to the entry that replaces it.
      { key: "amount", value: target.amount },
      { key: "currency", value: target.currency },
      // The correction occurs when the error is established, not when the corrected entry occurred.
      { key: "occurredAt", value: this.clock.now() },
      ...(awaitingReissue ? [{ key: "reissue", value: "pending" }] : []),
      ...(input.description ? [{ key: "description", value: input.description }] : []),
    ]);
  }

  /** Records what actually happened, on the same position, through the entry's own scenario. */
  private async reissue(
    input: SubmitRectificationInput,
    plan: Extract<ReturnType<typeof planReissue>, { reissuable: true }>,
  ): Promise<SubmitIntentResult | { missingSlot: string }> {
    const { intentId } = await this.startIntent.execute({
      scenarioId: plan.scenarioId,
      userId: input.userId,
    });

    // Only the restated fields override what the Ledger already holds. A field the operator did not
    // touch is carried over, so a correction of the amount cannot quietly move the date as well.
    const corrected = input.corrected ?? {};
    const overrides = new Map<string, string>();
    if (corrected.amount) overrides.set("amount", corrected.amount);
    if (corrected.occurredAt) overrides.set("occurredAt", corrected.occurredAt);
    if (corrected.description) overrides.set("description", corrected.description);

    const answers = plan.answers.map((a) => ({ key: a.key, value: overrides.get(a.key) ?? a.value }));
    for (const [key, value] of overrides) {
      if (!answers.some((a) => a.key === key)) answers.push({ key, value });
    }

    const merged = await this.applyAnswers.execute({ intentId, answers });
    if (merged.rejected.length > 0) {
      throw new Error(`Could not describe the entry: ${merged.rejected.map((r) => r.message).join("; ")}`);
    }
    // A PARTY answer that the Directory cannot resolve is not recorded — by design, so that an
    // unknown counterparty is asked about rather than invented. The record alone is then not enough
    // to describe the corrected entry, and saying so beats submitting something incomplete.
    if (merged.state.kind === "question") {
      return { missingSlot: merged.state.slot.key };
    }

    return this.submitIntent.execute(intentId);
  }

  private async fill(
    intentId: string,
    answers: { key: string; value: string }[],
  ): Promise<SubmitIntentResult> {
    const merged = await this.applyAnswers.execute({ intentId, answers });
    if (merged.rejected.length > 0) {
      throw new Error(`Could not describe the entry: ${merged.rejected.map((r) => r.message).join("; ")}`);
    }
    return this.submitIntent.execute(intentId);
  }
}
