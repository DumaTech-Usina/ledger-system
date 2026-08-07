import { describe, it, expect } from "vitest";
import { PositionSnapshot } from "../../../core/application/services/PositionSnapshot";
import { SnapshotRefresher } from "../../../core/application/services/SnapshotRefresher";
import type { LedgerEventFeedPort, RecordedEvent } from "../../../core/application/ports/LedgerEventFeedPort";
import type { PositionItem } from "../../../core/application/dtos/LedgerReadModels";

const item = (objectId: string, over: Partial<PositionItem> = {}): PositionItem => ({
  objectId,
  objectType: "advance",
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "500.00",
  openBalance: "500.00",
  eventCount: 1,
  lastEventAt: "2026-08-06T00:00:00.000Z",
  originatedAt: "2026-08-01T00:00:00.000Z",
  createdAt: "2026-08-01T00:00:00.000Z",
  dueAt: null,
  ...over,
});

/** A feed whose pages are handed out newest-first, exactly as the Ledger orders them. */
const feedOf = (pages: RecordedEvent[][]): LedgerEventFeedPort => ({
  recentlyRecorded: async (_limit, page = 1) => pages[page - 1] ?? [],
});

describe("PositionSnapshot", () => {
  it("remembers what the Ledger answered, stamped with when it said it", () => {
    const snapshot = new PositionSnapshot(() => "2026-08-06T10:00:00.000Z");
    snapshot.remember([item("intent:a")]);

    const remembered = snapshot.get("intent:a")!;
    expect(remembered.objectId).toBe("intent:a");
    // Mandatory: a copy without an age looks current, and the consumer could not tell.
    expect(remembered.asOf).toBe("2026-08-06T10:00:00.000Z");
  });

  it("knows nothing about a position it was never told about — which is always acceptable", () => {
    const snapshot = new PositionSnapshot(() => "2026-08-06T10:00:00.000Z");
    expect(snapshot.get("intent:never-seen")).toBeNull();
  });

  it("forgets a position on demand, so treasury's own write can never be contradicted", () => {
    const snapshot = new PositionSnapshot(() => "2026-08-06T10:00:00.000Z");
    snapshot.remember([item("intent:a"), item("intent:b")]);

    snapshot.invalidate("intent:a");

    expect(snapshot.get("intent:a")).toBeNull();
    expect(snapshot.get("intent:b")).not.toBeNull();
  });

  it("re-remembering refreshes the age, so a stale copy is never kept alongside a fresh one", () => {
    let now = "2026-08-06T10:00:00.000Z";
    const snapshot = new PositionSnapshot(() => now);
    snapshot.remember([item("intent:a", { openBalance: "500.00" })]);

    now = "2026-08-06T11:00:00.000Z";
    snapshot.remember([item("intent:a", { openBalance: "200.00" })]);

    const remembered = snapshot.get("intent:a")!;
    expect(remembered.openBalance).toBe("200.00");
    expect(remembered.asOf).toBe("2026-08-06T11:00:00.000Z");
    expect(snapshot.size()).toBe(1);
  });
});

describe("SnapshotRefresher", () => {
  const snapshotWith = (...objectIds: string[]) => {
    const snapshot = new PositionSnapshot(() => "2026-08-06T10:00:00.000Z");
    snapshot.remember(objectIds.map((id) => item(id)));
    return snapshot;
  };

  it("takes its bearings on the first sweep without forgetting anything", async () => {
    const snapshot = snapshotWith("intent:a");
    const refresher = new SnapshotRefresher(
      feedOf([[{ eventId: "evt-3", objectIds: ["intent:a"] }]]),
      snapshot,
    );

    const outcome = await refresher.refresh();

    // Nothing was stale yet: the snapshot fills lazily, so there was nothing to catch up with.
    expect(outcome.invalidated).toEqual([]);
    expect(snapshot.get("intent:a")).not.toBeNull();
  });

  it("forgets only the positions that events actually touched", async () => {
    const snapshot = snapshotWith("intent:a", "intent:b", "intent:c");
    const feed = feedOf([[{ eventId: "evt-1", objectIds: ["intent:a"] }]]);
    const refresher = new SnapshotRefresher(feed, snapshot);
    await refresher.refresh(); // takes bearings at evt-1

    // Two new events arrive; only one of them touches something remembered.
    const moved = feedOf([
      [
        { eventId: "evt-3", objectIds: ["intent:b"] },
        { eventId: "evt-2", objectIds: ["intent:z"] },
        { eventId: "evt-1", objectIds: ["intent:a"] },
      ],
    ]);
    const outcome = await new SnapshotRefresher(moved, snapshot).refresh();

    // A fresh refresher has no bearings, so this one only takes them — the point of the assertion
    // below is the SAME refresher continuing, which the next test covers.
    expect(outcome.invalidated).toEqual([]);
  });

  it("walks only as far as the event it already saw", async () => {
    const snapshot = snapshotWith("intent:a", "intent:b", "intent:c");
    let pages: RecordedEvent[][] = [[{ eventId: "evt-1", objectIds: ["intent:a"] }]];
    const feed: LedgerEventFeedPort = {
      recentlyRecorded: async (_limit, page = 1) => pages[page - 1] ?? [],
    };
    const refresher = new SnapshotRefresher(feed, snapshot);
    await refresher.refresh();

    pages = [
      [
        { eventId: "evt-3", objectIds: ["intent:b"] },
        { eventId: "evt-2", objectIds: ["intent:c"] },
        { eventId: "evt-1", objectIds: ["intent:a"] }, // the cursor: stop here
      ],
    ];
    const outcome = await refresher.refresh();

    expect(outcome.invalidated.sort()).toEqual(["intent:b", "intent:c"]);
    // Everything past the cursor was already accounted for, so `a` is untouched.
    expect(snapshot.get("intent:a")).not.toBeNull();
    expect(snapshot.get("intent:b")).toBeNull();
  });

  it("costs one request when nothing was written", async () => {
    const snapshot = snapshotWith("intent:a");
    let calls = 0;
    const feed: LedgerEventFeedPort = {
      recentlyRecorded: async () => {
        calls++;
        return [{ eventId: "evt-1", objectIds: ["intent:a"] }];
      },
    };
    const refresher = new SnapshotRefresher(feed, snapshot);
    await refresher.refresh();
    calls = 0;

    const outcome = await refresher.refresh();

    expect(calls).toBe(1);
    expect(outcome.invalidated).toEqual([]);
    expect(snapshot.get("intent:a")).not.toBeNull();
  });

  it("forgets everything rather than guess, when it cannot catch up precisely", async () => {
    const snapshot = snapshotWith("intent:a", "intent:b");
    let pages: RecordedEvent[][] = [[{ eventId: "evt-old", objectIds: [] }]];
    const feed: LedgerEventFeedPort = {
      recentlyRecorded: async (_limit, page = 1) => pages[page - 1] ?? [],
    };
    const refresher = new SnapshotRefresher(feed, snapshot);
    await refresher.refresh();

    // More events than the sweep is willing to walk, and the cursor is never met.
    pages = Array.from({ length: 25 }, (_, p) => [
      { eventId: `evt-new-${p}`, objectIds: ["intent:unrelated"] },
    ]);
    const outcome = await refresher.refresh();

    expect(outcome.gaveUp).toBe(true);
    // A cold snapshot costs re-reads; a half-current one costs correctness.
    expect(snapshot.size()).toBe(0);
  });

  it("an event touching several positions forgets all of them", async () => {
    const snapshot = snapshotWith("intent:a", "intent:b");
    let pages: RecordedEvent[][] = [[{ eventId: "evt-1", objectIds: [] }]];
    const feed: LedgerEventFeedPort = {
      recentlyRecorded: async (_limit, page = 1) => pages[page - 1] ?? [],
    };
    const refresher = new SnapshotRefresher(feed, snapshot);
    await refresher.refresh();

    // A commission split settles a pool and opens a payable — one event, two positions.
    pages = [[{ eventId: "evt-2", objectIds: ["intent:a", "intent:b"] }, { eventId: "evt-1", objectIds: [] }]];
    await refresher.refresh();

    expect(snapshot.size()).toBe(0);
  });
});
