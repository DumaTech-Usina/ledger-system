import { ProposalContext } from "../../core/application/dtos/ProposalContext";

export interface ProposalContextInput {
  proposalId: string;
  proposalNumber: string;
  operatorId: string;
  operatorName?: string | null;
  planId: string;
  brokerId: string;
  brokerName?: string | null;
  supervisorId?: string | null;
  supervisorName?: string | null;
  registeredAt: string;
  [key: string]: unknown;
}

export class ProposalContextJob {
  normalize(inputs: ProposalContextInput[]): ProposalContext[] {
    const seen = new Set<string>();
    const result: ProposalContext[] = [];

    for (const input of inputs) {
      if (!isNonEmpty(input.proposalId)) {
        warn("Rejected: proposalId null or empty");
        continue;
      }
      if (!isNonEmpty(input.operatorId)) {
        warn(`Rejected ${input.proposalId}: operatorId null or empty`);
        continue;
      }
      if (!isNonEmpty(input.brokerId)) {
        warn(`Rejected ${input.proposalId}: brokerId null or empty`);
        continue;
      }
      if (!isNonEmpty(input.planId)) {
        warn(`Rejected ${input.proposalId}: planId null or empty`);
        continue;
      }
      if (!isNonEmpty(input.proposalNumber)) {
        warn(`Rejected ${input.proposalId}: proposalNumber null or empty`);
        continue;
      }

      const registeredAt = new Date(input.registeredAt);
      if (isNaN(registeredAt.getTime())) {
        warn(`Rejected ${input.proposalId}: registeredAt is not a valid date`);
        continue;
      }

      if (seen.has(input.proposalId)) {
        warn(`Skipped duplicate proposalId: ${input.proposalId}`);
        continue;
      }

      seen.add(input.proposalId);
      result.push({
        proposalId: input.proposalId,
        proposalNumber: input.proposalNumber,
        operatorId: input.operatorId,
        planId: input.planId,
        brokerId: input.brokerId,
        supervisorId: input.supervisorId ?? null,
        registeredAt,
      });
    }

    return result;
  }
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function warn(message: string): void {
  console.warn(`[ProposalContextJob] ${message}`);
}
