import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { Relation } from "../../domain/enums/Relation";

/**
 * Which events no longer stand.
 *
 * A retraction (an event carrying RETRACTS) declares, via `relatedEventId`, that the event it names
 * never corresponded to the world. A retracted event stays in the chain — hashed, provenanced,
 * readable — but stops contributing to every figure derived from it. Nothing is rewritten: what
 * changes is what the derivation counts.
 *
 * The fold is bounded by the approved depth of 1: a retraction may itself be retracted (and then no
 * longer stands, so its target counts again), but a retraction OF a retraction cannot be retracted.
 * One hop is therefore enough — no recursion, and no chain to walk.
 *
 * This is the single source of truth for the in-memory paths. The SQL aggregates express the same
 * rule as two nested NOT EXISTS; the equivalence tests are what keep the two honest, since SQL
 * cannot call this function.
 */
export function retractedEventIds(events: readonly LedgerEvent[]): Set<string> {
  const retractionByTarget = new Map<string, string>();

  for (const event of events) {
    if (!event.relatedEventId) continue;
    if (!event.getObjects().some((o) => o.relation === Relation.RETRACTS)) continue;
    retractionByTarget.set(event.relatedEventId, event.id.value);
  }

  const retracted = new Set<string>();
  for (const [targetId, retractionId] of retractionByTarget) {
    // A retraction that was itself retracted no longer stands, so its target stands again.
    if (retractionByTarget.has(retractionId)) continue;
    retracted.add(targetId);
  }
  return retracted;
}

/** What one position's standing events add up to, in minor units. */
export interface ObjectTotals {
  /** Sum of ORIGINATES — the baseline the position was opened with. Zero means no baseline exists. */
  originatedUnits: bigint;
  /** Sum of SETTLES and ADJUSTS — everything that closes against the baseline. */
  closedUnits: bigint;
  /**
   * Whether a standing REVERSES is on record. A reversal subtracts from no total — it voids the
   * position's arithmetic outright, which is why `derivePositionStatus` returns "reversed" before
   * looking at any figure. Anything measuring the baseline must respect the same precedence.
   */
  hasReversal: boolean;
}

/**
 * Folds the events of ONE economic object into the two totals conservation is measured with.
 *
 * A fourth expression of the rule the projection, the in-memory aggregate and the SQL aggregate all
 * express — deliberately so, because the write path cannot depend on a read service, and because it
 * needs only two of the numbers those produce. `ADJUSTS` counts as closing, exactly as
 * `derivePositionStatus` treats it: `totalClosed = totalSettled + totalAdjusted`.
 *
 * Pinned against the projection by `object-totals-equivalence.test.ts` — a duplicated rule needs a
 * test that fixes the copies against each other, and this one has four.
 */
export function foldObjectTotals(
  events: readonly LedgerEvent[],
  objectId: string,
): ObjectTotals {
  const retracted = retractedEventIds(events);
  let originatedUnits = 0n;
  let closedUnits = 0n;
  let hasReversal = false;

  for (const event of events) {
    if (retracted.has(event.id.value)) continue;
    const units = event.amount.toUnits();

    for (const object of event.getObjects()) {
      if (object.objectId.value !== objectId) continue;
      if (object.relation === Relation.ORIGINATES) originatedUnits += units;
      else if (object.relation === Relation.SETTLES || object.relation === Relation.ADJUSTS) {
        closedUnits += units;
      } else if (object.relation === Relation.REVERSES) hasReversal = true;
    }
  }

  return { originatedUnits, closedUnits, hasReversal };
}
