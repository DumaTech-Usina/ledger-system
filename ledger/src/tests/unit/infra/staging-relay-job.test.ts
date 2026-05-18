import { describe, it, expect, vi } from "vitest";
import { StagingRelayJob } from "../../../infra/jobs/StagingRelayJob";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { MessagePublisher } from "../../../core/application/ports/MessagePublisher";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ROUTING_KEY = "staging.receipt";

function makeRecord(id: string): StagingRecord {
  return {
    id,
    status: "pending",
    eventType: "commission_received",
    sourceReference: `ref-${id}`,
  };
}

function makePublisher(options: { failAll?: boolean; failIds?: string[] } = {}): MessagePublisher {
  return {
    publish: vi.fn(async (_key: string, payload: unknown) => {
      const id = (payload as StagingRecord).id;
      if (options.failAll || options.failIds?.includes(id)) {
        throw new Error(`Broker unreachable for record ${id}`);
      }
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StagingRelayJob — forwarding staged commission records to the message broker", () => {

  it("when the staging queue is empty, the broker is never contacted — no unnecessary network round-trips when there is nothing to relay", async () => {
    const stagingRepo = new InMemoryStagingRepository([]);
    const publisher = makePublisher();

    await new StagingRelayJob(stagingRepo, publisher).run();

    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("two pending records are each published to the broker under the 'staging.receipt' routing key — the relay preserves the correct message topology so downstream consumers can subscribe correctly", async () => {
    const stagingRepo = new InMemoryStagingRepository([makeRecord("r-1"), makeRecord("r-2")]);
    const publisher = makePublisher();

    await new StagingRelayJob(stagingRepo, publisher).run();

    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(publisher.publish).toHaveBeenCalledWith(ROUTING_KEY, expect.objectContaining({ id: "r-1" }));
    expect(publisher.publish).toHaveBeenCalledWith(ROUTING_KEY, expect.objectContaining({ id: "r-2" }));
  });

  it("after a successful broker acknowledgement, the record remains in 'queued' status — it is not reverted because the broker confirmed receipt", async () => {
    const stagingRepo = new InMemoryStagingRepository([makeRecord("r-success")]);

    await new StagingRelayJob(stagingRepo, makePublisher()).run();

    const [record] = await stagingRepo.findAll();
    expect(record.status).toBe("queued");
  });

  it("when the broker rejects one record, that record is rolled back to 'pending' so the next relay cycle will retry it — exactly-once delivery requires that failed forwards are never silently lost", async () => {
    const stagingRepo = new InMemoryStagingRepository([makeRecord("r-fail")]);
    const publisher = makePublisher({ failIds: ["r-fail"] });

    await new StagingRelayJob(stagingRepo, publisher).run();

    const [record] = await stagingRepo.findAll();
    expect(record.status).toBe("pending");
  });

  it("a broker failure on one record does not affect the others — partial relay is safer than total failure, each record's delivery fate is independent", async () => {
    const stagingRepo = new InMemoryStagingRepository([
      makeRecord("r-ok-1"),
      makeRecord("r-fail"),
      makeRecord("r-ok-2"),
    ]);
    const publisher = makePublisher({ failIds: ["r-fail"] });

    await new StagingRelayJob(stagingRepo, publisher).run();

    const records = await stagingRepo.findAll();
    const byId = Object.fromEntries(records.map((r) => [r.id, r.status]));

    expect(byId["r-ok-1"]).toBe("queued");
    expect(byId["r-fail"]).toBe("pending");
    expect(byId["r-ok-2"]).toBe("queued");
  });

  it("when the broker is completely down and every publish fails, all records are rolled back to 'pending' — no records are silently abandoned during a total broker outage", async () => {
    const stagingRepo = new InMemoryStagingRepository([makeRecord("r-1"), makeRecord("r-2")]);
    const publisher = makePublisher({ failAll: true });

    await new StagingRelayJob(stagingRepo, publisher).run();

    const records = await stagingRepo.findAll();
    expect(records.every((r) => r.status === "pending")).toBe(true);
  });

  it("running relay on an already-empty queue completes without throwing — the job is idempotent when there is nothing to do and must never crash on an empty run", async () => {
    const stagingRepo = new InMemoryStagingRepository([]);

    await expect(new StagingRelayJob(stagingRepo, makePublisher()).run()).resolves.not.toThrow();
  });

});
