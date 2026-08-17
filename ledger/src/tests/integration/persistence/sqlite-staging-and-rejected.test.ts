import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { MIGRATIONS } from "../../../infra/database/data-source";
import { SqliteStagingRepository } from "../../../infra/persistence/sqlite/SqliteStagingRepository";
import { SqliteRejectedEventRepository } from "../../../infra/persistence/sqlite/SqliteRejectedEventRepository";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { RejectedEvent } from "../../../core/domain/entities/RejectedEvent";
import { StagingId } from "../../../core/domain/value-objects/StagingId";
import { RejectionReason } from "../../../core/domain/value-objects/RejectionReason";
import { RejectionType } from "../../../core/domain/value-objects/RejectionType";

/**
 * The two stores that used to be a MongoDB, now tables in the book's own file.
 *
 * What is checked is the behaviour their callers depend on and nothing about how it is stored: that
 * a record survives the round trip whole, that a claim is exclusive, that re-ingesting the same
 * external fact does not reset a record the pipeline has already moved on. The staging repository is
 * asked the same questions as the in-memory twin the rest of the suite runs on, so the two cannot
 * drift apart unnoticed.
 */
function record(id: string, overrides: Partial<StagingRecord> = {}): StagingRecord {
  return {
    id,
    status: "pending",
    eventType: "commission_received",
    economicEffect: "cash_in",
    occurredAt: "2026-06-20T10:00:00.000Z",
    dueAt: null,
    amount: "5000.00",
    currency: "BRL",
    sourceSystem: "normalizer",
    sourceReference: `REF-${id}`,
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-test",
    parties: [{ partyId: "party-usina", role: "payee", direction: "in", amount: "5000.00" }],
    objects: [{ objectId: `obj-${id}`, objectType: "commission_receivable", relation: "settles" }],
    reason: {
      type: "commission_payment",
      description: "Pagamento de comissão recebido",
      confidence: "high",
      requiresFollowup: false,
    },
    reporter: { reporterType: "system", reporterId: "worker-test", channel: "batch" },
    ...overrides,
  };
}

let ds: DataSource;
let staging: SqliteStagingRepository;
let rejected: SqliteRejectedEventRepository;

beforeAll(async () => {
  ds = new DataSource({
    type: "better-sqlite3",
    database: ":memory:",
    entities: [],
    migrations: MIGRATIONS,
    migrationsRun: true,
    synchronize: false,
  });
  await ds.initialize();
  staging = new SqliteStagingRepository(ds);
  rejected = new SqliteRejectedEventRepository(ds);
});

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

beforeEach(async () => {
  await ds.query("DELETE FROM staging_records");
  await ds.query("DELETE FROM rejected_events");
});

describe("SqliteStagingRepository", () => {
  it("returns a saved record exactly as it was staged", async () => {
    const original = record("stg-1");
    await staging.save(original);

    const [found] = await staging.findAll();
    // Field for field, including the nested parties, objects and reason — a candidate travels
    // whole or the pipeline validates something other than what arrived.
    expect(found).toEqual(original);
  });

  it("answers the same as the in-memory twin for the same book", async () => {
    const records = [record("stg-1"), record("stg-2"), record("stg-3")];
    for (const item of records) await staging.save(item);
    const memory = new InMemoryStagingRepository(records.map((item) => ({ ...item })));

    const sort = (items: StagingRecord[]) =>
      [...items].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(await staging.findAll())).toEqual(sort(await memory.findAll()));

    const page = await staging.findPaginated({ page: 1, limit: 2 });
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(2);
    expect(page.data).toHaveLength(2);
  });

  it("claims a pending record once — a second claimer finds nothing left", async () => {
    await staging.save(record("stg-1"));
    await staging.save(record("stg-2"));

    const first = await staging.claimPending("processing", 10);
    expect(first).toHaveLength(2);
    // The caller is handed the record as it now stands, not as it was a moment before.
    expect(first.every((item) => item.status === "processing")).toBe(true);

    // Nothing is pending any more, so there is nothing for a second reader to take.
    expect(await staging.claimPending("processing", 10)).toEqual([]);
  });

  it("claims only the event types asked for, and no more than the limit", async () => {
    await staging.save(record("stg-1"));
    await staging.save(record("stg-2", { eventType: "advance_payment" }));
    await staging.save(record("stg-3", { eventType: "advance_payment" }));

    const advances = await staging.claimPending("queued", 10, ["advance_payment"]);
    expect(advances.map((item) => item.id).sort()).toEqual(["stg-2", "stg-3"]);

    // The commission is untouched — a filtered claim leaves what it did not ask for pending.
    const rest = await staging.claimPending("processing", 1);
    expect(rest.map((item) => item.id)).toEqual(["stg-1"]);
  });

  it("moves a record through the statuses the pipeline writes", async () => {
    await staging.save(record("stg-1"));

    await staging.markAsAccepted("stg-1");
    expect((await staging.findAll())[0].status).toBe("accepted");

    await staging.markAsRejected("stg-1");
    expect((await staging.findAll())[0].status).toBe("rejected");

    await staging.markAsPending("stg-1");
    expect((await staging.findAll())[0].status).toBe("pending");
  });

  it("does not reset a record the pipeline has already moved on", async () => {
    await staging.save(record("stg-1"));
    await staging.markAsAccepted("stg-1");

    // The same external fact ingested a second time. Overwriting here would send an already-posted
    // event back to pending and the job would record it twice.
    await staging.save(record("stg-1"));

    const all = await staging.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("accepted");
  });

  it("treats the same source reference as the same candidate, whatever id it arrives under", async () => {
    await staging.save(record("stg-1"));
    await staging.save(record("stg-2", { sourceReference: "REF-stg-1" }));

    expect(await staging.findAll()).toHaveLength(1);
  });
});

describe("SqliteRejectedEventRepository", () => {
  const refusal = (stagingId: string) =>
    RejectedEvent.create({
      stagingId: new StagingId(stagingId),
      reasons: [
        new RejectionReason(RejectionType.INVALID_SCHEMA, "missing required field: amount"),
        new RejectionReason(RejectionType.INVALID_SCHEMA, "missing required field: currency"),
      ],
      rawPayload: { sourceReference: "REF-broken", amount: null },
    });

  it("keeps every reason and the original payload of a refusal", async () => {
    const event = refusal("stg-broken");
    await rejected.save(event);

    const [found] = await rejected.findAll();
    expect(found.id.value).toBe(event.id.value);
    expect(found.stagingId.value).toBe("stg-broken");
    // The instant survives the round trip exactly — a refusal is an audit record, and when it
    // happened is part of it.
    expect(found.rejectedAt.toISOString()).toBe(event.rejectedAt.toISOString());
    expect(found.reasons.map((reason) => reason.description)).toEqual([
      "missing required field: amount",
      "missing required field: currency",
    ]);
    // The snapshot of what was refused, kept verbatim so the refusal can be explained later.
    expect(found.rawPayload).toEqual({ sourceReference: "REF-broken", amount: null });
  });

  it("pages the refusals", async () => {
    for (const id of ["a", "b", "c"]) await rejected.save(refusal(id));

    const page = await rejected.findPaginated({ page: 2, limit: 2 });
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(2);
    expect(page.data).toHaveLength(1);
  });

  it("keeps a refusal that carried no payload distinguishable from one that carried an empty one", async () => {
    const withoutPayload = RejectedEvent.create({
      stagingId: new StagingId("stg-nopayload"),
      reasons: [new RejectionReason(RejectionType.INVALID_SCHEMA, "nothing to read")],
    });
    await rejected.save(withoutPayload);

    const [found] = await rejected.findAll();
    // Absent, not `null` and not `{}` — the record does not claim a payload was seen and was empty.
    expect(found.rawPayload).toBeUndefined();
  });
});
