import { IntentStatus } from "../enums/IntentStatus";
import { SlotValue } from "../value-objects/Slot";
import { IntentNotEditableError } from "../errors/IntentNotEditableError";

/**
 * Where answers may still change (§11.1). Listed rather than excluded, so that a status added later
 * is closed until someone decides otherwise.
 */
const EDITABLE: ReadonlySet<IntentStatus> = new Set([
  IntentStatus.GATHERING,
  IntentStatus.AWAITING_CONFIRMATION,
  IntentStatus.AWAITING_CORRECTION,
]);

/**
 * Where a proposed fact came from, when it was not the user's own conversation (§4.6). The source
 * reference replaces `intent:<id>` on the candidate, so the Ledger's duplicate check covers the same
 * external record however many times it is read (REQ-265). The confidence is what the way of knowing
 * allows (REQ-806): a signal seen on another system's screen is medium, never high.
 */
export interface IntentOrigin {
  signalId: string;
  sourceReference: string;
  confidence: "medium";
  /** Read only from intents stored before `contexts` existed (2026-11-09); carried over on rehydrate. */
  context?: ContextRef;
}

/**
 * What a fact is about, cited with `references`: a policy (`contract`), a proposal, a batch. It
 * annotates the event without moving any balance, and lets the Ledger answer "every fact of this
 * policy" (REQ-267, REQ-275).
 */
export interface ContextRef {
  objectId: string;
  objectType: string;
}

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
  /** Present only on a fact proposed from an external signal. */
  origin?: IntentOrigin;
  /**
   * The contexts the fact will cite: those of the signal it came from, or those of the fact that
   * opened the position it continues (REQ-275).
   */
  contexts?: ContextRef[];
}

/**
 * A user's in-progress or completed intention for a scenario. Owns the intent lifecycle
 * inside the User App. It never carries economic authority — the Ledger decides whether a
 * candidate derived from it becomes a fact.
 */
export class Intent {
  private constructor(private readonly props: IntentProps) {}

  static start(
    id: string,
    scenarioId: string,
    userId: string,
    now: string,
    answers: Record<string, SlotValue> = {},
    origin?: IntentOrigin,
    contexts: ContextRef[] = [],
  ): Intent {
    return new Intent({
      id,
      scenarioId,
      userId,
      status: IntentStatus.GATHERING,
      answers: { ...answers },
      createdAt: now,
      updatedAt: now,
      ...(origin ? { origin: cloneOrigin(origin) } : {}),
      ...(contexts.length > 0 ? { contexts: contexts.map((c) => ({ ...c })) } : {}),
    });
  }

  static rehydrate(props: IntentProps): Intent {
    const contexts = props.contexts ?? (props.origin?.context ? [props.origin.context] : []);
    return new Intent({
      ...props,
      answers: { ...props.answers },
      ...(props.origin ? { origin: cloneOrigin(props.origin) } : {}),
      ...(contexts.length > 0 ? { contexts: contexts.map((c) => ({ ...c })) } : {}),
    });
  }

  get id(): string { return this.props.id; }
  get scenarioId(): string { return this.props.scenarioId; }
  get userId(): string { return this.props.userId; }
  get status(): IntentStatus { return this.props.status; }
  get answers(): Record<string, SlotValue> { return { ...this.props.answers }; }
  get ledgerReference(): string | undefined { return this.props.ledgerReference; }
  get rejectionReason(): string | undefined { return this.props.rejectionReason; }
  get origin(): IntentOrigin | undefined { return this.props.origin ? cloneOrigin(this.props.origin) : undefined; }
  get contexts(): ContextRef[] { return (this.props.contexts ?? []).map((c) => ({ ...c })); }

  /**
   * Throws once the candidate has left for the Ledger and its fate is settled. Use cases call it up
   * front so that a refused edit leaves nothing behind; `record` calls it too, so no path can skip it.
   */
  assertEditable(): void {
    if (!EDITABLE.has(this.props.status)) throw new IntentNotEditableError(this.props.id, this.props.status);
  }

  /** Record an answer for a slot. Stays in GATHERING; the use case decides when it's ready. */
  record(key: string, value: SlotValue, now: string): void {
    this.assertEditable();
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
    return {
      ...this.props,
      answers: { ...this.props.answers },
      ...(this.props.origin ? { origin: cloneOrigin(this.props.origin) } : {}),
      ...(this.props.contexts ? { contexts: this.props.contexts.map((c) => ({ ...c })) } : {}),
    };
  }
}

const cloneOrigin = (o: IntentOrigin): IntentOrigin => ({ ...o, ...(o.context ? { context: { ...o.context } } : {}) });
