import type { LedgerEventLookupPort } from "../ports/LedgerEventLookupPort";
import type { LedgerEventRef } from "../dtos/LedgerReadModels";

/**
 * One event as the Ledger recorded it. The record already existed on this boundary — the
 * rectification flow reads it to describe what it corrects — but only from inside; a reader holding
 * an eventId from a movement or a lifecycle had nowhere to resolve it. This makes the same record
 * readable, and adds nothing to it.
 *
 * `null` when the Ledger knows no such event, which is a legitimate answer and not an error: the
 * book not knowing an id is different from the book being unreachable.
 */
export class GetLedgerEventUseCase {
  constructor(private readonly ledger: LedgerEventLookupPort) {}

  execute(eventId: string): Promise<LedgerEventRef | null> {
    return this.ledger.event(eventId);
  }
}
