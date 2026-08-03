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
