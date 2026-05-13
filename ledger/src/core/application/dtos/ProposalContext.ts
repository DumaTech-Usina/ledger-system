export interface ProposalContext {
  proposalId: string;
  proposalNumber: string;
  operatorId: string;
  planId: string;
  brokerId: string;
  supervisorId: string | null;
  registeredAt: Date;
}
