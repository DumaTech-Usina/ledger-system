export interface ProposalContext {
  proposalId: string;
  proposalNumber: string;
  operatorId: string;
  brokerId: string | null;
  supervisorId: string | null;
  registeredAt: Date;
}
