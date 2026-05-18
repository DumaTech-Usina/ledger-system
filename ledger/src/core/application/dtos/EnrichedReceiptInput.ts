/** A receipt pre-joined with its proposal context via a server-side cursor.
 *  Node never holds the full proposals dataset in memory. */
export interface EnrichedReceiptInput {
  receiptId: string;
  proposalId: string;
  installmentNumber: number;
  downloadedValue: string;
  dischargeDate: string | null;
  receiptStatus: string;
  proposalNumber: string;
  operatorId: string;
  brokerId: string | null;
  registeredAt: string;
}
