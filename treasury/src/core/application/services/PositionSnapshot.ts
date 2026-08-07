import type { PositionItem } from "../dtos/LedgerReadModels";

/**
 * A copy of a position the Ledger already answered with, kept only to make navigating faster.
 *
 * ## Why this is a different type, and not just `PositionItem`
 *
 * Because the difference has to be impossible to lose. A `SnapshotPosition` carries the same
 * figures, but it is a HURRIED COPY of an answer rather than the answer — and every rule below
 * exists to stop it becoming the second one:
 *
 *   - it may be stale, so it carries `asOf` and nothing may read it without seeing that;
 *   - it may never reach a write path: no candidate is ever built from these figures;
 *   - it may reveal and order, never hide or forbid.
 *
 * The brand is the barrier that works on its own. `SnapshotPosition` is not assignable to
 * `PositionItem`, so a snapshot cannot flow into a function expecting the Ledger's answer even by
 * accident — the compiler refuses, and no convention has to be remembered.
 */
declare const snapshotBrand: unique symbol;

export interface SnapshotPosition {
  readonly [snapshotBrand]: true;
  objectId: string;
  objectType: string;
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  openBalance: string | null;
  eventCount: number;
  lastEventAt: string | null;
  originatedAt: string | null;
  createdAt: string | null;
  /** Copied like every other figure. Null here means the Ledger said null — never "not copied". */
  dueAt: string | null;
  /**
   * When the Ledger said this. Mandatory: a copy without an age looks current, and a consumer that
   * cannot see the age cannot decide whether it is good enough for what it is about to do.
   */
  asOf: string;
}

/**
 * A discardable, in-memory copy of positions the Ledger has already answered with.
 *
 * Filled lazily — never rebuilt eagerly at boot. An eager rebuild costs O(positions) requests every
 * deploy for data most of which nobody will look at; filling on read costs nothing and reaches the
 * same place. A cold snapshot is indistinguishable from an empty one to every consumer, because it
 * is never the source of an answer, only the head start on one.
 *
 * ## What it may and may not do
 *
 * It may list, sort, filter and render early. It may not decide anything: no figure it holds may
 * be published as a book total, and nothing it holds may reach `CandidateMapper`. The import
 * barrier in `snapshot-isolation.test.ts` enforces the second one mechanically.
 */
export class PositionSnapshot {
  private readonly byObjectId = new Map<string, SnapshotPosition>();

  constructor(private readonly now: () => string) {}

  /**
   * Remembers what the Ledger just answered with. Called from read paths only — the point is to
   * capture answers already given, never to fetch on the snapshot's own initiative.
   */
  remember(positions: readonly PositionItem[]): void {
    const asOf = this.now();
    for (const position of positions) {
      this.byObjectId.set(position.objectId, {
        ...position,
        asOf,
      } as SnapshotPosition);
    }
  }

  /** What is remembered about a position, with its age — or nothing, which is always acceptable. */
  get(objectId: string): SnapshotPosition | null {
    return this.byObjectId.get(objectId) ?? null;
  }

  /**
   * Forgets a position. Called after every write treasury makes, so the cache can never contradict
   * something treasury itself just did — the one kind of staleness it has no excuse for.
   */
  invalidate(objectId: string): void {
    this.byObjectId.delete(objectId);
  }

  /** Forgets several at once — what the cursor refresher hands back after a sweep. */
  invalidateAll(objectIds: Iterable<string>): void {
    for (const objectId of objectIds) this.byObjectId.delete(objectId);
  }

  /** Forgets everything. The safe answer when the cache cannot be caught up precisely. */
  clear(): void {
    this.byObjectId.clear();
  }

  size(): number {
    return this.byObjectId.size;
  }
}
