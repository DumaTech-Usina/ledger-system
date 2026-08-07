import {
  continuitySlot,
  counterpartySlot,
  inheritsCounterparty,
  lineageSlot,
  variantSlot,
} from "../services/CandidateMapper";
import type { LedgerEventLookupPort } from "../ports/LedgerEventLookupPort";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { StartIntentUseCase } from "./StartIntent";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { DialogState } from "../../domain/services/DialogEngine";

export interface StartPositionActionInput {
  objectId: string;
  scenarioId: string;
  userId: string;
  /** The branch, when the scenario has variants — chosen with the action, not asked again. */
  variantChoice?: string;
}

export interface StartPositionActionResult {
  intentId: string;
  /** Where the conversation picks up: the first thing still unanswered. */
  state: DialogState;
  /** The answer keys the position supplied, so the interface can show what it already knows. */
  prefilled: string[];
}

/**
 * Opens a conversation already knowing which position it is about.
 *
 * The whole point is that the operator arrives from the position rather than from the action, so
 * everything the position can answer is answered before the first question. What is left is what
 * only the operator knows: usually a date, and — when money moves — an amount.
 *
 * Nothing new is invented to do this. Continuity, lineage and counterparty are ordinary answers to
 * ordinary slots, merged through the same validator every other operation uses; the difference is
 * only who supplies them. An answer the position cannot supply is simply not sent, and the
 * conversation asks for it exactly as it always has.
 *
 * ## Why the counterparty is not always carried over
 *
 * Because it is not always the same party. A settlement of an advance is paid by whoever received
 * it, so carrying it over removes a chance to mistype. A commission is received from an operator
 * and then SPLIT — to a partner, to several people, to pay a fee — and carrying the operator across
 * would produce a record that is valid and false. Which is which is declared per scenario
 * (`inheritsCounterparty`), never inferred.
 */
export class StartPositionActionUseCase {
  constructor(
    private readonly lifecycle: PositionLifecyclePort,
    private readonly ledgerEvents: LedgerEventLookupPort,
    private readonly startIntent: StartIntentUseCase,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly usinaPartyId: string,
  ) {}

  async execute(input: StartPositionActionInput): Promise<StartPositionActionResult> {
    const position = await this.lifecycle.lifecycle(input.objectId);
    if (!position) throw new Error(`Unknown position: ${input.objectId}`);

    const { intentId } = await this.startIntent.execute({
      scenarioId: input.scenarioId,
      userId: input.userId,
    });

    const answers: { key: string; value: string }[] = [{ key: "currency", value: position.currency }];

    const variant = variantSlot(input.scenarioId);
    if (variant && input.variantChoice) answers.push({ key: variant, value: input.variantChoice });

    const continuity = continuitySlot(input.scenarioId);
    if (continuity) answers.push({ key: continuity, value: position.objectId });

    // The origination that still STANDS. A retracted one names an event a correction already
    // declared never happened, and pointing new lineage at it would revive a fact the book withdrew.
    const origination = position.events.find(
      (event) => !event.retracted && event.relation === "originates",
    );

    const lineage = lineageSlot(input.scenarioId);
    if (lineage && origination) answers.push({ key: lineage, value: origination.eventId });

    const counterparty = counterpartySlot(input.scenarioId);
    if (counterparty && inheritsCounterparty(input.scenarioId) && origination) {
      const party = await this.counterpartyOf(origination.eventId);
      if (party) answers.push({ key: counterparty, value: party });
    }

    const merged = await this.applyAnswers.execute({ intentId, answers });

    // Rejected answers are the position's, not the operator's — a figure treasury derived that the
    // scenario refuses. Surfacing it as a question they cannot answer would be worse than useless,
    // so it fails loudly here instead.
    if (merged.rejected.length > 0) {
      throw new Error(
        `Could not open the operation from this position: ${merged.rejected
          .map((r) => r.message)
          .join("; ")}`,
      );
    }

    return {
      intentId,
      state: merged.state,
      prefilled: answers.map((a) => a.key).filter((key) => !merged.rejected.some((r) => r.key === key)),
    };
  }

  /** The other side of the origination — absent when the Ledger holds no record of it. */
  private async counterpartyOf(eventId: string): Promise<string | null> {
    const event = await this.ledgerEvents.event(eventId);
    return event?.parties.find((p) => p.partyId !== this.usinaPartyId)?.partyId ?? null;
  }
}
