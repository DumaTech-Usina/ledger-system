import { Db } from "mongodb";
import { EnrichedReceiptInput } from "../../core/application/dtos/EnrichedReceiptInput";
import { ReceiptETLReader } from "../../core/application/ports/ReceiptETLReader";

export class MongoReceiptETLReader implements ReceiptETLReader {
  constructor(private readonly db: Db) {}

  /**
   * Runs a $lookup aggregation that inner-joins receipts to their clean proposals
   * entirely server-side. Receipts with no matching clean proposal are dropped by
   * the $unwind stage. The Node process holds at most one cursor batch at a time
   * regardless of collection size.
   *
   * Index requirements for performance:
   *   - aspirant_receipt_canonical: { 'metadata.receiptValidationStatus': 1 }
   *   - canonical_proposals: { proposal_id: 1, status: 1 }
   */
  async *streamEnrichedReceipts(): AsyncGenerator<EnrichedReceiptInput> {
    const cursor = this.db.collection("aspirant_receipt_canonical").aggregate([
      { $match: { "metadata.receiptValidationStatus": "CLEAN" } },
      {
        $lookup: {
          from: "canonical_proposals",
          localField: "proposal_id",
          foreignField: "proposal_id",
          pipeline: [
            { $match: { status: "CLEAN" } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                proposal_id: 1,
                number: 1,
                client_id: 1,
                effective_date: 1,
                updated_at: 1,
              },
            },
          ],
          as: "proposal",
        },
      },
      // $unwind with no preserveNullAndEmptyArrays acts as an inner join:
      // receipts with zero matching proposals are silently dropped.
      { $unwind: "$proposal" },
      {
        $project: {
          _id: 0,
          receipt_id: 1,
          proposal_id: 1,
          installment_number: 1,
          downloaded_value: 1,
          discharge_date: 1,
          receipt_status: 1,
          created_at: 1,
          "proposal.number": 1,
          "proposal.client_id": 1,
          "proposal.effective_date": 1,
          "proposal.updated_at": 1,
        },
      },
    ]);

    for await (const doc of cursor) {
      const p = doc.proposal as Record<string, unknown>;
      const registeredAt = isNonEmptyString(p.effective_date)
        ? (p.effective_date as string)
        : p.updated_at instanceof Date
          ? (p.updated_at as Date).toISOString()
          : new Date().toISOString();
      // Receipt creation date == true ABERTA-start == commission accrual date.
      // TODO(confirm): canonical field name assumed `created_at`. Falls back to
      // registeredAt when absent so the pipeline degrades gracefully instead of the
      // builder rejecting every receipt on an invalid date.
      const createdAt =
        doc.created_at instanceof Date
          ? doc.created_at.toISOString()
          : isNonEmptyString(doc.created_at)
            ? (doc.created_at as string)
            : registeredAt;
      yield {
        receiptId: doc.receipt_id as string,
        proposalId: doc.proposal_id as string,
        installmentNumber: doc.installment_number as number,
        downloadedValue: doc.downloaded_value as string,
        dischargeDate:
          doc.discharge_date instanceof Date
            ? doc.discharge_date.toISOString()
            : null,
        receiptStatus: doc.receipt_status as string,
        proposalNumber: p.number as string,
        operatorId: p.client_id as string,
        brokerId: null,
        registeredAt,
        createdAt,
      };
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
