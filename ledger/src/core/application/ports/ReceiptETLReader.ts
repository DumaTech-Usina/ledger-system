import { ProposalContextInput } from "../dtos/ProposalContextInput";
import { ReceiptPostingInput } from "../dtos/ReceiptPostingInput";

export interface ReceiptETLReader {
  fetchCleanProposals(): Promise<ProposalContextInput[]>;
  fetchCleanReceipts(): Promise<ReceiptPostingInput[]>;
}
