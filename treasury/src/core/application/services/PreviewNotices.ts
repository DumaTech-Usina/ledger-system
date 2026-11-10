import type { Intent } from "../../domain/entities/Intent";
import { INSURANCE_SYSTEM, sourceReferenceFor } from "../../domain/services/InsuranceSignal";
import type { PositionsPage } from "../dtos/LedgerReadModels";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { PositionsQuery } from "../ports/LedgerReadPort";
import { toCents } from "../utils/cents";

export type PreviewNotice =
  /** REQ-268: the payout leaves before the policy's commission was seen coming in. Not a refusal. */
  | { code: "payout_before_receipt"; policyId: string }
  /** REQ-270: what is already open with this person, so the user can decide to offset. Never applied. */
  | {
      code: "open_with_party";
      partyId: string;
      positions: { objectId: string; objectType: string; openBalance: string | null }[];
    }
  /** The Ledger could not be read: whatever these would have said is unknown. */
  | { code: "notices_unavailable" };

const OBLIGATION_PREFIX = `${INSURANCE_SYSTEM}:apolice:`;
const OBLIGATION_SUFFIX = ":elegibilidade";
const OPEN_STATUSES = ["open", "partially_settled", "unknown_origin"];


/**
 * What the preview should say beside the candidate (§4.6, block C). Give it a positions reader that
 * already leaves contexts out (`positionsOnly`, DEC-035): a policy is not something open with anyone.
 * Only shows: the candidate is the same with or without these, and the Ledger stays the one that
 * accepts or refuses (REQ-102).
 */
export class PreviewNotices {
  constructor(
    private readonly lifecycle: PositionLifecyclePort,
    private readonly ledger: { positions(params?: PositionsQuery): Promise<PositionsPage> },
  ) {}

  async for(intent: Intent): Promise<PreviewNotice[]> {
    const a = intent.answers;
    const notices: PreviewNotice[] = [];

    if (intent.scenarioId === "register_commission_payment") {
      const policyId = policyOfObligation(a.objectRef);
      if (policyId) {
        const expected = await this.lifecycle.lifecycle(sourceReferenceFor(policyId, "commission_expected"));
        if (!expected || toCents(expected.totalSettled) === 0n) notices.push({ code: "payout_before_receipt", policyId });
      }
    }

    const commissionObligation = intent.scenarioId === "register_obligation_recognition" && a.kind === "commission";
    if ((commissionObligation || intent.scenarioId === "register_commission_payment") && a.payee?.trim()) {
      const page = await this.ledger.positions({ partyId: a.payee, status: OPEN_STATUSES, limit: 50 });
      const positions = page.data
        .filter((p) => p.objectId !== a.objectRef?.trim())
        .map((p) => ({ objectId: p.objectId, objectType: p.objectType, openBalance: p.openBalance }));
      if (positions.length > 0) notices.push({ code: "open_with_party", partyId: a.payee, positions });
    }

    return notices;
  }
}

function policyOfObligation(objectRef: string | undefined): string | null {
  const ref = objectRef?.trim() ?? "";
  return ref.startsWith(OBLIGATION_PREFIX) && ref.endsWith(OBLIGATION_SUFFIX)
    ? ref.slice(OBLIGATION_PREFIX.length, -OBLIGATION_SUFFIX.length)
    : null;
}
