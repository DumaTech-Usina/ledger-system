import type { Intent } from "../../domain/entities/Intent";
import { INSURANCE_SYSTEM, sourceReferenceFor } from "../../domain/services/InsuranceSignal";
import type { PositionsPage } from "../dtos/LedgerReadModels";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { PositionsQuery } from "../ports/LedgerReadPort";
import { fromCents, toCents } from "../utils/cents";

export type PreviewNotice =
  /** REQ-268: the payout leaves before the policy's commission was seen coming in. Not a refusal. */
  | { code: "payout_before_receipt"; policyId: string }
  /** REQ-270: what is already open with this person, so the user can decide to offset. Never applied. */
  | {
      code: "open_with_party";
      partyId: string;
      positions: { objectId: string; objectType: string; openBalance: string | null }[];
    }
  /**
   * REQ-635: the payout passes what is open on the commission obligation. The preview offers paying
   * the open part of the obligation and the excess as an advance (or another way). Never applied, and
   * never a statement that anything was overpaid (REJ-634).
   */
  | { code: "exceeds_open"; objectId: string; openBalance: string; excess: string }
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
      if (intent.scenarioId === "register_commission_payment") {
        const exceeds = exceedsOpen(page, a.objectRef, a.amount);
        if (exceeds) notices.push(exceeds);
      }
      const positions = page.data
        .filter((p) => p.objectId !== a.objectRef?.trim())
        .map((p) => ({ objectId: p.objectId, objectType: p.objectType, openBalance: p.openBalance }));
      if (positions.length > 0) notices.push({ code: "open_with_party", partyId: a.payee, positions });
    }

    return notices;
  }
}

/**
 * REQ-635. The obligation is the one the payout is linked to; without a link, the only commission
 * obligation open with the person, when there is exactly one. With several and no link, what to offer
 * is still to be decided (REQ-635), so nothing is offered rather than a guess.
 */
function exceedsOpen(
  page: PositionsPage,
  objectRef: string | undefined,
  amount: string | undefined,
): Extract<PreviewNotice, { code: "exceeds_open" }> | null {
  let paying: bigint;
  try {
    paying = toCents(amount ?? "");
  } catch {
    return null;
  }
  const ref = objectRef?.trim();
  const open = page.data.filter((p) => p.objectType === "commission_payable" && p.openBalance !== null && p.originatedAt !== null);
  const obligation = ref ? open.find((p) => p.objectId === ref) : open.length === 1 ? open[0] : undefined;
  if (!obligation?.openBalance) return null;
  const openCents = toCents(obligation.openBalance);
  if (openCents <= 0n || paying <= openCents) return null;
  return { code: "exceeds_open", objectId: obligation.objectId, openBalance: obligation.openBalance, excess: fromCents(paying - openCents) };
}

function policyOfObligation(objectRef: string | undefined): string | null {
  const ref = objectRef?.trim() ?? "";
  return ref.startsWith(OBLIGATION_PREFIX) && ref.endsWith(OBLIGATION_SUFFIX)
    ? ref.slice(OBLIGATION_PREFIX.length, -OBLIGATION_SUFFIX.length)
    : null;
}
