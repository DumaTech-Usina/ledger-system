import { randomUUID } from "node:crypto";
import { userActor, type AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";
import { toCents } from "../utils/cents";

/** One obligation in a prepared batch and the amount this payment puts on it. */
export interface PreparedBatchItem {
  objectId: string;
  amount: string;
  /**
   * Filled when the batch is prepared from the agenda (REQ-651): who is paid, what kind of obligation
   * it is, and the scenario that settles it — read from the Ledger once, so paying needs no guess.
   */
  payee?: string;
  objectType?: string;
  scenarioId?: string;
}

/** What happened to one line when the payment was recorded (REQ-653). */
export interface BatchPaymentStep {
  objectId: string;
  amount: string;
  status: "accepted" | "rejected" | "awaiting_correction" | "failed" | "not_sent";
  intentId?: string;
  ledgerReference?: string;
  reason?: string;
}

/** The bank payment of a batch: recorded once (REQ-654), with each line's outcome. */
export interface BatchPayment {
  by: string;
  recordedAt: string;
  /** The day the money left the bank, as the user stated it. */
  occurredAt: string;
  /** The institution's key, or null when the user explicitly said it is not known (REQ-650). */
  institution: string | null;
  /** The single debit the bank shows. */
  debit: string;
  /** "recording" while the events go out one by one; "recorded" once every line has an outcome. */
  state: "recording" | "recorded";
  steps: BatchPaymentStep[];
}

/**
 * REQ-239: the obligations a user picked for one bank payment, before the bank pays. A Treasury draft,
 * never a fact: preparing or discarding one sends nothing to the Ledger. When the payment is recorded,
 * the batch becomes the events of REQ-246.
 */
export interface PreparedBatch {
  batchId: string;
  /** The party it pays, when prepared on that party's page; null when assembled on the agenda (REQ-651). */
  partyId: string | null;
  items: PreparedBatchItem[];
  preparedBy: string;
  preparedAt: string;
  /** Set once, when the batch is discarded. A discarded batch holds no obligation any more. */
  discarded?: { by: string; at: string };
  /** Set once, when the payment is recorded (REQ-653). A paid batch holds no obligation any more. */
  payment?: BatchPayment;
}

export const isStanding = (batch: PreparedBatch): boolean => !batch.discarded && !batch.payment;

export interface PreparedBatchStore {
  save(batch: PreparedBatch): Promise<void>;
  get(batchId: string): Promise<PreparedBatch | null>;
  /** Batches that are still standing (neither discarded nor paid). */
  standing(): Promise<PreparedBatch[]>;
  /** Batches whose payment was recorded, the latest first. */
  paid(limit: number): Promise<PreparedBatch[]>;
  /**
   * Starts the payment of a standing batch, atomically: true when this call took it, false when it
   * was no longer standing. Two clicks on "paid" must not send the batch twice (REQ-654).
   */
  claimForPayment(batchId: string, payment: BatchPayment): Promise<boolean>;
}

export class InMemoryPreparedBatchStore implements PreparedBatchStore {
  private readonly batches = new Map<string, PreparedBatch>();

  async save(batch: PreparedBatch): Promise<void> {
    this.batches.set(batch.batchId, structuredClone(batch));
  }

  async get(batchId: string): Promise<PreparedBatch | null> {
    const batch = this.batches.get(batchId);
    return batch ? structuredClone(batch) : null;
  }

  async standing(): Promise<PreparedBatch[]> {
    return [...this.batches.values()].filter(isStanding).map((b) => structuredClone(b));
  }

  async paid(limit: number): Promise<PreparedBatch[]> {
    return [...this.batches.values()]
      .filter((b) => b.payment)
      .sort((a, b) => b.payment!.recordedAt.localeCompare(a.payment!.recordedAt))
      .slice(0, limit)
      .map((b) => structuredClone(b));
  }

  async claimForPayment(batchId: string, payment: BatchPayment): Promise<boolean> {
    const batch = this.batches.get(batchId);
    if (!batch || !isStanding(batch)) return false;
    this.batches.set(batchId, { ...structuredClone(batch), payment: structuredClone(payment) });
    return true;
  }
}

export class PreparedBatchError extends Error {}

export class PreparedBatches {
  constructor(
    private readonly audit: Pick<AuditLog, "record">,
    private readonly clock: Clock,
    private readonly store: PreparedBatchStore = new InMemoryPreparedBatchStore(),
  ) {}

  async prepare(input: { partyId: string | null; items: PreparedBatchItem[]; by: string }): Promise<{ batchId: string }> {
    const partyId = input.partyId === null ? null : input.partyId?.trim();
    const by = input.by?.trim();
    if (partyId === "" || partyId === undefined) throw new PreparedBatchError("A prepared batch needs the party it pays.");
    if (!by) throw new PreparedBatchError("A prepared batch needs who prepared it.");
    if (!input.items?.length) throw new PreparedBatchError("A prepared batch needs at least one obligation.");

    const seen = new Set<string>();
    for (const item of input.items) {
      if (!item.objectId?.trim()) throw new PreparedBatchError("Every obligation in a batch needs its id.");
      if (seen.has(item.objectId)) throw new PreparedBatchError(`Obligation ${item.objectId} appears twice in the batch.`);
      seen.add(item.objectId);
      let cents: bigint;
      try {
        cents = toCents(item.amount);
      } catch {
        throw new PreparedBatchError(`The amount for ${item.objectId} is not an amount.`);
      }
      if (cents <= 0n) throw new PreparedBatchError(`The amount for ${item.objectId} must be greater than zero.`);
    }

    // REJ-239: one obligation in at most one standing prepared batch.
    for (const batch of await this.store.standing()) {
      const taken = batch.items.find((i) => seen.has(i.objectId));
      if (taken) throw new PreparedBatchError(`A obrigação ${taken.objectId} já está num lote preparado (${batch.batchId}).`);
    }

    const batch: PreparedBatch = {
      batchId: `batch-${randomUUID()}`,
      partyId,
      items: input.items.map((i) => ({ ...i, objectId: i.objectId.trim(), amount: i.amount.trim() })),
      preparedBy: by,
      preparedAt: this.clock.now(),
    };
    // REQ-652: preparing is audited, like discarding and paying.
    await this.audit.record({
      actor: userActor(by),
      intentId: batch.batchId,
      at: batch.preparedAt,
      type: "prepared_batch_prepared",
      detail: `${batch.items.length} obligation(s): ${batch.items.map((i) => `${i.objectId} ${i.amount}`).join(", ")}`,
    });
    await this.store.save(batch);
    return { batchId: batch.batchId };
  }

  /** CA-239: frees the obligations for another batch; who discarded it is audited (REQ-804). */
  async discard(batchId: string, by: string): Promise<void> {
    const who = by?.trim();
    if (!who) throw new PreparedBatchError("Discarding a prepared batch needs who discarded it.");
    const batch = await this.store.get(batchId);
    if (!batch) throw new PreparedBatchError(`Prepared batch ${batchId} does not exist.`);
    if (batch.discarded) throw new PreparedBatchError(`Prepared batch ${batchId} was already discarded.`);
    if (batch.payment) throw new PreparedBatchError(`Prepared batch ${batchId} was already paid; a paid batch is not discarded.`);

    const at = this.clock.now();
    // Audited before the batch lets go of its obligations: a discard nobody can trace never happens.
    await this.audit.record({
      actor: userActor(who),
      // The audit is keyed by what it is about; for a batch, that is the batch.
      intentId: batch.batchId,
      at,
      type: "prepared_batch_discarded",
      detail: `party ${batch.partyId ?? "(agenda)"}; ${batch.items.length} obligation(s): ${batch.items.map((i) => i.objectId).join(", ")}`,
    });
    await this.store.save({ ...batch, discarded: { by: who, at } });
  }

  /**
   * Takes a standing batch for payment (REQ-654): from here on it is no longer standing, so neither a
   * second payment nor a discard can reach it. Audited before anything is sent.
   */
  async startPayment(batchId: string, payment: Omit<BatchPayment, "state" | "steps" | "recordedAt">): Promise<PreparedBatch> {
    const batch = await this.store.get(batchId);
    if (!batch) throw new PreparedBatchError(`O lote ${batchId} não existe.`);
    if (batch.discarded) throw new PreparedBatchError("Este lote foi descartado; prepare outro.");
    if (batch.payment) throw new PreparedBatchError("O pagamento deste lote já foi anotado.");

    const started: BatchPayment = { ...payment, recordedAt: this.clock.now(), state: "recording", steps: [] };
    if (!(await this.store.claimForPayment(batchId, started))) {
      throw new PreparedBatchError("O pagamento deste lote já foi anotado.");
    }
    await this.audit.record({
      actor: userActor(payment.by),
      intentId: batchId,
      at: started.recordedAt,
      type: "prepared_batch_paid",
      detail: `debit ${payment.debit} on ${payment.occurredAt}; institution ${payment.institution ?? "not stated"}`,
    });
    return { ...batch, payment: started };
  }

  /** Keeps each line's outcome as it comes, so a crash midway leaves visible what was already sent. */
  async recordProgress(batch: PreparedBatch): Promise<void> {
    await this.store.save(batch);
  }

  async get(batchId: string): Promise<PreparedBatch | null> {
    return this.store.get(batchId);
  }

  async standing(): Promise<PreparedBatch[]> {
    return this.store.standing();
  }

  async recentlyPaid(limit: number): Promise<PreparedBatch[]> {
    return this.store.paid(limit);
  }

  /** The standing batches that pay a party, for its page (REQ-239: the batch shows in Operação). */
  async ofParty(partyId: string): Promise<PreparedBatch[]> {
    return (await this.store.standing()).filter((b) => b.partyId === partyId || b.items.some((i) => i.payee === partyId));
  }
}
