import { randomUUID } from "node:crypto";
import { userActor, type AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";
import { toCents } from "../utils/cents";

/**
 * REQ-239: the obligations a user picked for one bank payment, before the bank pays. A Treasury draft,
 * never a fact: preparing or discarding one sends nothing to the Ledger. When the payment is recorded,
 * the batch becomes the events of REQ-246 (step 4).
 */
export interface PreparedBatch {
  batchId: string;
  partyId: string;
  items: { objectId: string; amount: string }[];
  preparedBy: string;
  preparedAt: string;
  /** Set once, when the batch is discarded. A discarded batch holds no obligation any more. */
  discarded?: { by: string; at: string };
}

export interface PreparedBatchStore {
  save(batch: PreparedBatch): Promise<void>;
  get(batchId: string): Promise<PreparedBatch | null>;
  /** Batches that are still standing (not discarded). */
  standing(): Promise<PreparedBatch[]>;
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
    return [...this.batches.values()].filter((b) => !b.discarded).map((b) => structuredClone(b));
  }
}

export class PreparedBatchError extends Error {}

export class PreparedBatches {
  constructor(
    private readonly audit: Pick<AuditLog, "record">,
    private readonly clock: Clock,
    private readonly store: PreparedBatchStore = new InMemoryPreparedBatchStore(),
  ) {}

  async prepare(input: { partyId: string; items: { objectId: string; amount: string }[]; by: string }): Promise<{ batchId: string }> {
    const partyId = input.partyId?.trim();
    const by = input.by?.trim();
    if (!partyId) throw new PreparedBatchError("A prepared batch needs the party it pays.");
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
      if (taken) throw new PreparedBatchError(`Obligation ${taken.objectId} is already in prepared batch ${batch.batchId}.`);
    }

    const batch: PreparedBatch = {
      batchId: `batch-${randomUUID()}`,
      partyId,
      items: input.items.map((i) => ({ objectId: i.objectId.trim(), amount: i.amount.trim() })),
      preparedBy: by,
      preparedAt: this.clock.now(),
    };
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

    const at = this.clock.now();
    // Audited before the batch lets go of its obligations: a discard nobody can trace never happens.
    await this.audit.record({
      actor: userActor(who),
      // The audit is keyed by what it is about; for a batch, that is the batch.
      intentId: batch.batchId,
      at,
      type: "prepared_batch_discarded",
      detail: `party ${batch.partyId}; ${batch.items.length} obligation(s): ${batch.items.map((i) => i.objectId).join(", ")}`,
    });
    await this.store.save({ ...batch, discarded: { by: who, at } });
  }

  /** The standing batches of a party, for its page (REQ-239: the batch shows in Operação). */
  async ofParty(partyId: string): Promise<PreparedBatch[]> {
    return (await this.store.standing()).filter((b) => b.partyId === partyId);
  }
}
