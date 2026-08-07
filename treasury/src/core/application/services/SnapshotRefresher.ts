import type { LedgerEventFeedPort } from "../ports/LedgerEventFeedPort";
import type { PositionSnapshot } from "./PositionSnapshot";

/** How many events one sweep reads per page before asking for another. */
const PAGE_SIZE = 100;

/**
 * Bounds how far back a single sweep will walk. Reached only when more than PAGE_SIZE × this many
 * events landed between two runs, which at a 60-minute interval means something unusual happened.
 * Walking further would trade a bounded catch-up for an unbounded one; forgetting everything is
 * cheaper and strictly safer, because forgetting can only cost a re-read.
 */
const MAX_PAGES = 20;

export interface RefreshOutcome {
  /** Positions forgotten this sweep. */
  invalidated: string[];
  /** True when the sweep gave up walking and cleared its bearings instead. */
  gaveUp: boolean;
}

/**
 * Keeps the snapshot honest against writers treasury did not make.
 *
 * The Ledger has more than one producer — the staging pipeline and the workers write to the same
 * book — and treasury only knows about its own submissions. Everything else would drift for as long
 * as the process lived. This walks the events by RECORDING order until it reaches one it already
 * saw, forgets the positions those events touched, and stops.
 *
 * Cost when nothing changed: one request. Cost when something did: one request plus the positions
 * that actually moved. That is why it is a cursor and not a sweep of the whole book.
 *
 * ## Why forgetting, rather than re-reading
 *
 * Because forgetting cannot be wrong. A forgotten position is fetched from the Ledger the next time
 * anyone looks at it; a re-read here would put this class in the business of deciding what the
 * current figures are, which is exactly what the snapshot must never do.
 */
export class SnapshotRefresher {
  /** The newest event this has already accounted for. Null until the first sweep. */
  private cursor: string | null = null;

  constructor(
    private readonly feed: LedgerEventFeedPort,
    private readonly snapshot: PositionSnapshot,
  ) {}

  async refresh(): Promise<RefreshOutcome> {
    const touched = new Set<string>();
    let newestSeen: string | null = null;
    let reachedCursor = this.cursor === null;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const events = await this.feed.recentlyRecorded(PAGE_SIZE, page);
      if (events.length === 0) {
        reachedCursor = true;
        break;
      }
      if (newestSeen === null) newestSeen = events[0].eventId;

      for (const event of events) {
        if (event.eventId === this.cursor) {
          reachedCursor = true;
          break;
        }
        for (const objectId of event.objectIds) touched.add(objectId);
      }
      if (reachedCursor) break;
    }

    // The first sweep only takes its bearings: the snapshot is filled lazily, so there is nothing
    // yet to be stale, and invalidating the whole book would be work with no effect.
    if (this.cursor === null) {
      this.cursor = newestSeen;
      return { invalidated: [], gaveUp: false };
    }

    // Walked the whole bound without meeting the cursor: too much happened to catch up precisely.
    // Forget everything rather than guess which half is current — a cold snapshot costs re-reads,
    // a half-current one costs correctness.
    if (!reachedCursor) {
      const forgotten = this.forgetEverything();
      this.cursor = newestSeen;
      return { invalidated: forgotten, gaveUp: true };
    }

    this.snapshot.invalidateAll(touched);
    if (newestSeen !== null) this.cursor = newestSeen;
    return { invalidated: [...touched], gaveUp: false };
  }

  private forgetEverything(): string[] {
    const before = this.snapshot.size();
    this.snapshot.clear();
    return before > 0 ? ["*"] : [];
  }
}
