import type { PositionsPage } from "../dtos/LedgerReadModels";
import type { PositionsQuery } from "../ports/LedgerReadPort";
import { HEALTH_EXPECTED_POSITION } from "../../domain/services/HealthSignal";

export interface InsurerReceivable {
  objectId: string;
  /** The policy, when the position came from the insurance system. Null otherwise: not guessed. */
  policyId: string | null;
  /** The proposal and installment, when it came from the health system (§4.7). Null otherwise. */
  installment: { proposalNumber: string; number: number } | null;
  openBalance: string | null;
  dueAt: string | null;
}

const POLICY_POSITION = /^seguro:apolice:(.+):prevista$/;

/** The Ledger's largest page. */
const PAGE_SIZE = 200;
/** Bounds the walk: 20.000 open commissions with one payer, far beyond any peak seen. */
const MAX_PAGES = 100;

/**
 * The expected commissions still open with one payer — what a credit from that insurer, or from that
 * health operator, can be distributed over (REQ-277, REQ-292). Possible because the payer is named on
 * the expected commission (REQ-273, REQ-288). Each one says what it is about: a policy, or an
 * installment of a proposal.
 */
export class ListInsurerReceivablesUseCase {
  constructor(private readonly ledger: { positions(params?: PositionsQuery): Promise<PositionsPage> }) {}

  async execute(payer: string): Promise<InsurerReceivable[]> {
    // The Ledger serves at most 200 a page; an operator can owe more than that in a peak fortnight
    // (2026-11-17). Every page is read, so no open installment is left out of the credit.
    const all: InsurerReceivable[] = [];
    for (let n = 1; n <= MAX_PAGES; n++) {
      const page = await this.ledger.positions({
        partyId: payer,
        objectType: "commission_receivable",
        status: ["open", "partially_settled"],
        limit: PAGE_SIZE,
        page: n,
        sortBy: "dueAt",
        sortOrder: "ASC",
      });
      for (const p of page.data) {
        const health = HEALTH_EXPECTED_POSITION.exec(p.objectId);
        all.push({
          objectId: p.objectId,
          policyId: POLICY_POSITION.exec(p.objectId)?.[1] ?? null,
          installment: health ? { proposalNumber: health[1], number: Number(health[2]) } : null,
          openBalance: p.openBalance,
          dueAt: p.dueAt,
        });
      }
      if (n >= page.totalPages || page.data.length === 0) break;
    }
    return all;
  }
}
