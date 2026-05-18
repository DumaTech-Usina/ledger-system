import { ProposalContext } from "../dtos/ProposalContext";
import { ProposalContextInput } from "../dtos/ProposalContextInput";
import { isNonEmpty } from "../utils/guards";

export class ProposalContextNormalizer {
  constructor(private readonly warn: (msg: string) => void = () => {}) {}

  normalize(inputs: ProposalContextInput[]): ProposalContext[] {
    const seen = new Set<string>();
    const result: ProposalContext[] = [];

    for (const input of inputs) {
      if (!isNonEmpty(input.proposalId)) {
        this.warn("Rejected: proposalId null or empty");
        continue;
      }
      if (!isNonEmpty(input.operatorId)) {
        this.warn(`Rejected ${input.proposalId}: operatorId null or empty`);
        continue;
      }
      if (!isNonEmpty(input.proposalNumber)) {
        this.warn(`Rejected ${input.proposalId}: proposalNumber null or empty`);
        continue;
      }

      const registeredAt = new Date(input.registeredAt);
      if (isNaN(registeredAt.getTime())) {
        this.warn(`Rejected ${input.proposalId}: registeredAt is not a valid date`);
        continue;
      }

      if (seen.has(input.proposalId)) {
        this.warn(`Skipped duplicate proposalId: ${input.proposalId}`);
        continue;
      }

      seen.add(input.proposalId);
      result.push({
        proposalId: input.proposalId,
        proposalNumber: input.proposalNumber,
        operatorId: input.operatorId,
        brokerId: input.brokerId ?? null,
        supervisorId: input.supervisorId ?? null,
        registeredAt,
      });
    }

    return result;
  }
}
