import { IntentStatus } from "../enums/IntentStatus";
import { SlotValue } from "../value-objects/Slot";

export interface IntentProps {
  id: string;
  scenarioId: string;
  userId: string;
  status: IntentStatus;
  answers: Record<string, SlotValue>;
  createdAt: string;
  updatedAt: string;
  /** Set once the Ledger accepts the candidate — its reference to the resulting fact. */
  ledgerReference?: string;
  /** Set once the Ledger rejects the candidate — the legible reason. */
  rejectionReason?: string;
}

/**
 * A user's in-progress or completed intention for a scenario. Owns the intent lifecycle
 * inside the User App. It never carries economic authority — the Ledger decides whether a
 * candidate derived from it becomes a fact.
 */
export class Intent {
  private constructor(private readonly props: IntentProps) {}

  static start(id: string, scenarioId: string, userId: string, now: string): Intent {
    return new Intent({
      id,
      scenarioId,
      userId,
      status: IntentStatus.GATHERING,
      answers: {},
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: IntentProps): Intent {
    return new Intent({ ...props, answers: { ...props.answers } });
  }

  get id(): string { return this.props.id; }
  get scenarioId(): string { return this.props.scenarioId; }
  get userId(): string { return this.props.userId; }
  get status(): IntentStatus { return this.props.status; }
  get answers(): Record<string, SlotValue> { return { ...this.props.answers }; }
  get ledgerReference(): string | undefined { return this.props.ledgerReference; }
  get rejectionReason(): string | undefined { return this.props.rejectionReason; }

  /** Record an answer for a slot. Stays in GATHERING; the use case decides when it's ready. */
  record(key: string, value: SlotValue, now: string): void {
    this.props.answers[key] = value;
    this.props.status = IntentStatus.GATHERING;
    this.props.updatedAt = now;
  }

  markAwaitingConfirmation(now: string): void {
    this.props.status = IntentStatus.AWAITING_CONFIRMATION;
    this.props.updatedAt = now;
  }

  /** Guarded confirm→submit transition; only an awaiting-confirmation intent may be submitted. */
  markSubmitted(now: string): void {
    if (this.props.status !== IntentStatus.AWAITING_CONFIRMATION) {
      throw new Error(`Intent ${this.props.id} is not ready to submit (status: ${this.props.status}).`);
    }
    this.props.status = IntentStatus.SUBMITTED;
    this.props.updatedAt = now;
  }

  /**
   * The Ledger rejected the candidate for a fixable reason. Non-terminal: the user corrects the
   * implicated slot(s) (via ApplyAnswers `edit`), which returns the intent to AWAITING_CONFIRMATION
   * for resubmission. Editing is what advances state — this only records the pending-fix status.
   */
  markAwaitingCorrection(now: string): void {
    this.props.status = IntentStatus.AWAITING_CORRECTION;
    this.props.updatedAt = now;
  }

  markAccepted(ledgerReference: string, now: string): void {
    this.props.status = IntentStatus.ACCEPTED;
    this.props.ledgerReference = ledgerReference;
    this.props.updatedAt = now;
  }

  markRejected(reason: string, now: string): void {
    this.props.status = IntentStatus.REJECTED;
    this.props.rejectionReason = reason;
    this.props.updatedAt = now;
  }

  toJSON(): IntentProps {
    return { ...this.props, answers: { ...this.props.answers } };
  }
}
