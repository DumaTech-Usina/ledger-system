import type { Db } from "mongodb";
import type { AdvanceReportReader } from "../../core/application/ports/AdvanceReportReader";
import type { EnrichedAdvanceInput } from "../../core/application/dtos/EnrichedAdvanceInput";

export class MongoAdvanceReportReader implements AdvanceReportReader {
  constructor(private readonly db: Db) {}

  /**
   * Aggregates aspirant_advance_canonical filtering CLEAN, paid, not-cancelled records.
   * All filtering is applied server-side so the Node process holds at most one cursor batch.
   *
   * Index requirements for performance:
   *   - aspirant_advance_canonical: { status: 1, is_paid: 1, is_cancelled: 1 }
   */
  async *streamCleanAdvances(): AsyncGenerator<EnrichedAdvanceInput> {
    const cursor = this.db.collection("aspirant_advance_canonical").aggregate([
      {
        $match: {
          status: "CLEAN",
          is_paid: true,
          is_cancelled: { $ne: true },
          amount_to_pay: { $gt: 0 },
          broker_id: { $exists: true, $ne: "" },
        },
      },
      {
        $project: {
          _id: 0,
          advance_report_id: 1,
          amount_to_pay: 1,
          broker_id: 1,
          is_paid: 1,
          is_cancelled: 1,
          updated_at: 1,
        },
      },
    ]);

    for await (const doc of cursor) {
      yield {
        advanceReportId: doc.advance_report_id as string,
        amountToPay: doc.amount_to_pay as number,
        brokerId: doc.broker_id as string,
        isPaid: doc.is_paid as boolean,
        isCancelled: doc.is_cancelled as boolean,
        createdAt: doc.updated_at instanceof Date ? doc.updated_at : new Date(),
      };
    }
  }
}
