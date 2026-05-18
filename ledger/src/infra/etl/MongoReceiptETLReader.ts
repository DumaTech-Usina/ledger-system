import { Db } from 'mongodb';
import { ProposalContextInput } from '../../../core/application/dtos/ProposalContextInput';
import { ReceiptPostingInput } from '../../../core/application/dtos/ReceiptPostingInput';
import { ReceiptETLReader } from '../../../core/application/ports/ReceiptETLReader';

export class MongoReceiptETLReader implements ReceiptETLReader {
  constructor(private readonly db: Db) {}

  async fetchCleanProposals(): Promise<ProposalContextInput[]> {
    const docs = await this.db
      .collection('canonical_proposals')
      .find({ status: 'CLEAN' })
      .toArray();

    return docs.map((doc) => ({
      proposalId: doc.proposal_id,
      proposalNumber: doc.number,
      operatorId: doc.client_id,
      planId: doc.plan_id,
      brokerId: null,
      registeredAt: isNonEmptyString(doc.effective_date)
        ? doc.effective_date
        : (doc.updated_at instanceof Date
            ? doc.updated_at.toISOString()
            : new Date().toISOString()),
    }));
  }

  async fetchCleanReceipts(): Promise<ReceiptPostingInput[]> {
    const docs = await this.db
      .collection('aspirant_receipt_canonical')
      .find({ 'metadata.receiptValidationStatus': 'CLEAN' })
      .toArray();

    return docs.map((doc) => ({
      receiptId: doc.receipt_id,
      proposalId: doc.proposal_id,
      installmentNumber: doc.installment_number,
      downloadedValue: doc.downloaded_value,
      dischargeDate: doc.discharge_date instanceof Date
        ? doc.discharge_date.toISOString()
        : null,
      receiptStatus: doc.receipt_status,
    }));
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
