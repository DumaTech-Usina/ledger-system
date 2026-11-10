import type { PositionsPage } from "../dtos/LedgerReadModels";
import type { PositionsQuery } from "../ports/LedgerReadPort";

export interface InsurerReceivable {
  objectId: string;
  /** The policy, when the position came from the insurance system. Null otherwise: not guessed. */
  policyId: string | null;
  openBalance: string | null;
  dueAt: string | null;
}

const POLICY_POSITION = /^seguro:apolice:(.+):prevista$/;

/**
 * The expected commissions still open with one payer — what a credit from that insurer can be
 * distributed over (REQ-277). Possible because the insurer is named as payer (REQ-273).
 */
export class ListInsurerReceivablesUseCase {
  constructor(private readonly ledger: { positions(params?: PositionsQuery): Promise<PositionsPage> }) {}

  async execute(payer: string): Promise<InsurerReceivable[]> {
    const page = await this.ledger.positions({
      partyId: payer,
      objectType: "commission_receivable",
      status: ["open", "partially_settled"],
      limit: 200,
      sortBy: "dueAt",
      sortOrder: "ASC",
    });
    return page.data.map((p) => ({
      objectId: p.objectId,
      policyId: POLICY_POSITION.exec(p.objectId)?.[1] ?? null,
      openBalance: p.openBalance,
      dueAt: p.dueAt,
    }));
  }
}
