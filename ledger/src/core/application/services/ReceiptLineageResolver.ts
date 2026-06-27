import { EventType } from "../../domain/enums/EventType";
import { ObjectType } from "../../domain/enums/ObjectType";
import { ValidatedStagingRecord } from "../dtos/StagingRecord";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";

/**
 * Resolves the causal lineage of a commission_received at the posting boundary — the only
 * place ledger ids exist. A received normally SETTLES a receivable that a COMMISSION_EXPECTED
 * originated (its "ignition point"); this finds that expected through the shared receivable
 * object.
 *
 * Find-only: the ledger never fabricates an origin. When no originating expected exists, this
 * returns null and the received is recorded as a first-class orphan (lineage unresolved), to be
 * linked later by a new fact backed by external evidence. This service deliberately holds no
 * write dependency, so it cannot create events.
 *
 * No-op for non-commission records — keeps StagingPostingJob generic.
 */
export class ReceiptLineageResolver {
  constructor(private readonly ledgerRepo: LedgerEventRepository) {}

  /** Returns the relatedEventId the received must link to, or null when its origin is unknown. */
  async resolve(record: ValidatedStagingRecord): Promise<string | null> {
    if (record.eventType !== EventType.COMMISSION_RECEIVED) {
      return record.relatedEventId ?? null;
    }
    if (record.relatedEventId) {
      return record.relatedEventId;
    }

    const receivable = record.objects.find(
      (o) => o.objectType === ObjectType.COMMISSION_RECEIVABLE,
    );
    if (!receivable?.objectId) {
      throw new Error(
        "commission_received has no commission_receivable object; cannot resolve lineage",
      );
    }

    // Find-only: no originating expected ⇒ null ⇒ orphan (linked later, never synthesized).
    return this.findExpected(receivable.objectId);
  }

  private async findExpected(
    receivableObjectId: string,
  ): Promise<string | null> {
    const events = await this.ledgerRepo.findByObjectId(receivableObjectId);
    const expected = events.find(
      (e) => e.eventType === EventType.COMMISSION_EXPECTED,
    );
    return expected ? expected.id.value : null;
  }
}
