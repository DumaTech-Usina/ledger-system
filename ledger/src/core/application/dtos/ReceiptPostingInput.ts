export interface ReceiptPostingInput {
  receiptId: string;
  proposalId: string;
  installmentNumber: number;
  downloadedValue: string;
  dischargeDate: string | null;
  receiptStatus: string;
}
