import type { LedgerEventLookupPort } from "../ports/LedgerEventLookupPort";
import type { Clock } from "../ports/Clock";
import type { StartIntentUseCase } from "./StartIntent";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { SubmitIntentUseCase, SubmitIntentResult } from "./SubmitIntent";

export interface SubmitRectificationInput {
  /** The event that never happened. */
  targetEventId: string;
  userId: string;
  /** What established the error — a document, a reconciliation. Optional but strongly advised. */
  description?: string;
}

/** Object kinds a rectification can name; the Ledger admits more, treasury maps these. */
const SUPPORTED_OBJECT_TYPES = new Set(["advance", "loan", "commission_receivable"]);

/**
 * Rectify a recorded entry: declare that it never corresponded to the world.
 *
 * It orchestrates the paths that already exist — start an intent, merge answers through the same
 * deterministic validator every other operation uses, submit through the same boundary — and adds
 * exactly one thing of its own: it reads the corrected event from the Ledger and fills the answers
 * from THAT, rather than from a second typing. The amount and the object of a correction therefore
 * cannot disagree with the entry it corrects, which is a class of error no validation downstream
 * could catch (the Ledger's own contract treats a correction's objects as informational).
 *
 * The tuple stays where it belongs: `CandidateMapper` builds it, as it does for every scenario.
 */
export class SubmitRectificationUseCase {
  constructor(
    private readonly ledgerEvents: LedgerEventLookupPort,
    private readonly startIntent: StartIntentUseCase,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly submitIntent: SubmitIntentUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(input: SubmitRectificationInput): Promise<SubmitIntentResult> {
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

    const { intentId } = await this.startIntent.execute({
      scenarioId: "register_rectification",
      userId: input.userId,
    });

    const answers = [
      { key: "target", value: target.eventId },
      { key: "objectRef", value: moved.objectId },
      { key: "objectType", value: moved.objectType },
      { key: "amount", value: target.amount },
      { key: "currency", value: target.currency },
      // The correction occurs when the error is established, not when the corrected entry occurred.
      { key: "occurredAt", value: this.clock.now() },
      ...(input.description ? [{ key: "description", value: input.description }] : []),
    ];

    const merged = await this.applyAnswers.execute({ intentId, answers });
    if (merged.rejected.length > 0) {
      throw new Error(`Could not describe the rectification: ${merged.rejected.map((r) => r.message).join("; ")}`);
    }

    return this.submitIntent.execute(intentId);
  }
}
