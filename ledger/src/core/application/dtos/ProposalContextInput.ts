export interface ProposalContextInput {
  proposalId: string;
  proposalNumber: string;
  operatorId: string;
  operatorName?: string | null;
  planId?: string | null;
  brokerId?: string | null;
  brokerName?: string | null;
  supervisorId?: string | null;
  supervisorName?: string | null;
  registeredAt: string;
  [key: string]: unknown;
}
