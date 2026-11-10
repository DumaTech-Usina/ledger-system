import { policyContext, sourceReferenceFor } from "../../domain/services/InsuranceSignal";
import type { SignalKind } from "../../domain/entities/ExternalSignal";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PositionLifecycle } from "../dtos/LedgerReadModels";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { ExternalSignalRepository } from "../repositories/ExternalSignalRepository";
import { fromCents, toCents } from "../utils/cents";

export type PolicyNotice =
  /** REQ-263: the insurer says it paid, and the Ledger has not seen that much come in. */
  | { code: "insurer_says_paid"; claimed: string; received: string }
  /** REQ-263: the insurer says it paid, but there is no expected commission to check a receipt against. */
  | { code: "expected_not_recorded"; claimed: string }
  /** REQ-268: money went to the broker for a policy whose commission has not been seen coming in. */
  | { code: "payout_without_receipt"; paid: string }
  /** REQ-271: without the date the commission is expected, it cannot be told whether it is late. */
  | { code: "expected_without_due_date" };

/**
 * One line of the policy's story (REQ-276). A fact is told from the Ledger's own record: what it was,
 * who it went from and to, and whether it still counts. A signal is told as what the insurance system
 * said — never as a fact.
 */
export type PolicyHistoryEntry =
  | {
      kind: "expected" | "obligation" | "received" | "paid" | "other";
      at: string;
      eventId: string;
      eventType: string;
      amount: string;
      /** Null when the fact named nobody on that side: not stated, not "nobody". */
      from: string | null;
      to: string | null;
      retracted: boolean;
      /** The batch the fact belongs to, when it cites one (REQ-277). */
      batchId: string | null;
    }
  | { kind: "signal"; at: string; signalKind: SignalKind; recordedBy: string };

export interface PolicySituation {
  policyId: string;
  /** Null when the Ledger has no expected commission for this policy: unknown, not zero. */
  expected: { positionId: string; originated: string; received: string; open: string | null; dueAt: string | null } | null;
  /** Null when no obligation to the broker is on the book. */
  obligation: { positionId: string; owed: string; paid: string; open: string | null; payee: string | null } | null;
  /**
   * REQ-264: what stays with the usina, read as the difference between the two facts above. Not an
   * event. Null when either fact is missing: one figure alone says nothing about the difference.
   */
  retained: string | null;
  notices: PolicyNotice[];
  /** REQ-268: the operations the policy suggests, each on the position it belongs to. */
  actions: { kind: "receive" | "pay"; objectId: string; scenarioId: string }[];
  /** REQ-276: every fact citing the policy, and every signal read about it, oldest first. */
  history: PolicyHistoryEntry[];
  /** Display names for the parties the history names. An unknown one keeps its id on screen. */
  partyNames: Record<string, string>;
}

/** How each kind of fact reads in the story, and which side of it the counterparty is on. */
const STORY: Record<string, { kind: "expected" | "obligation" | "received" | "paid"; usina: "from" | "to" }> = {
  commission_expected: { kind: "expected", usina: "to" },
  obligation_recognized: { kind: "obligation", usina: "from" },
  commission_received: { kind: "received", usina: "to" },
  commission_split: { kind: "paid", usina: "from" },
};

/**
 * What the Ledger knows about one policy, beside what the insurance system said about it (§4.6,
 * block C). Read-only: nothing here records anything, and every figure is one the Ledger published.
 */
export class GetPolicySituationUseCase {
  constructor(
    private readonly positions: PositionLifecyclePort,
    private readonly signals: ExternalSignalRepository,
    /** Usina's own id, to tell which side of each fact is ours. */
    private readonly usinaPartyId: string = "",
    /** Optional: without it the story names parties by id. */
    private readonly directory?: PartyDirectoryPort,
  ) {}

  async execute(policyId: string): Promise<PolicySituation> {
    const expectedId = sourceReferenceFor(policyId, "commission_expected");
    const obligationId = sourceReferenceFor(policyId, "commission_obligation");
    const [expectedPos, obligationPos, contextPos, signals] = await Promise.all([
      this.positions.lifecycle(expectedId),
      this.positions.lifecycle(obligationId),
      this.positions.lifecycle(policyContext(policyId).objectId),
      this.signals.list(),
    ]);

    const expected = expectedPos
      ? {
          positionId: expectedId,
          originated: expectedPos.totalOriginated,
          received: expectedPos.totalSettled,
          open: expectedPos.openBalance,
          dueAt: dueAtOf(expectedPos),
        }
      : null;
    const obligation = obligationPos
      ? {
          positionId: obligationId,
          owed: obligationPos.totalOriginated,
          paid: obligationPos.totalSettled,
          open: obligationPos.openBalance,
          payee: obligationPos.origin?.parties.find((p) => p.role === "payee")?.partyId ?? null,
        }
      : null;

    const notices: PolicyNotice[] = [];
    // The most recent eligibility read for this policy: what the insurer says it paid.
    const claim = signals.find((s) => s.kind === "eligibility" && s.recordId === policyId)?.toJSON().fields.usinaValue;
    if (claim) {
      if (!expected) notices.push({ code: "expected_not_recorded", claimed: claim });
      else if (toCents(expected.received) < toCents(claim)) {
        notices.push({ code: "insurer_says_paid", claimed: claim, received: expected.received });
      }
    }
    if (obligation && toCents(obligation.paid) > 0n && (!expected || toCents(expected.received) === 0n)) {
      notices.push({ code: "payout_without_receipt", paid: obligation.paid });
    }
    if (expected && expected.dueAt === null) notices.push({ code: "expected_without_due_date" });

    const actions: PolicySituation["actions"] = [];
    if (expected && isOpen(expected.open)) {
      actions.push({ kind: "receive", objectId: expectedId, scenarioId: "register_commission_received" });
    }
    if (obligation && isOpen(obligation.open)) {
      actions.push({ kind: "pay", objectId: obligationId, scenarioId: "register_commission_payment" });
    }

    const history = this.historyOf(contextPos, signals.filter((s) => s.recordId === policyId).map((s) => s.toJSON()));
    return {
      policyId,
      expected,
      obligation,
      retained: expected && obligation ? fromCents(toCents(expected.originated) - toCents(obligation.owed)) : null,
      notices,
      actions,
      history,
      partyNames: await this.namesOf(history),
    };
  }

  private historyOf(
    context: PositionLifecycle | null,
    signals: { kind: SignalKind; receivedAt: string; recordedBy: string }[],
  ): PolicyHistoryEntry[] {
    const facts: PolicyHistoryEntry[] = (context?.events ?? []).map((e) => {
      const story = STORY[e.eventType];
      const other = e.parties.find((p) => p.partyId !== this.usinaPartyId)?.partyId ?? null;
      const usina = e.parties.some((p) => p.partyId === this.usinaPartyId) ? this.usinaPartyId : null;
      return {
        kind: story?.kind ?? "other",
        at: e.occurredAt,
        eventId: e.eventId,
        eventType: e.eventType,
        amount: e.amount,
        from: story ? (story.usina === "from" ? usina : other) : null,
        to: story ? (story.usina === "to" ? usina : other) : null,
        retracted: e.retracted,
        batchId: e.objects.find((o) => o.objectType === "settlement_batch")?.objectId ?? null,
      };
    });
    const told: PolicyHistoryEntry[] = signals.map((s) => ({
      kind: "signal",
      at: s.receivedAt,
      signalKind: s.kind,
      recordedBy: s.recordedBy,
    }));
    return [...facts, ...told].sort((a, b) => a.at.localeCompare(b.at));
  }

  private async namesOf(history: PolicyHistoryEntry[]): Promise<Record<string, string>> {
    if (!this.directory) return {};
    const ids = new Set(history.flatMap((h) => ("from" in h ? [h.from, h.to] : [])).filter((id): id is string => !!id));
    const names: Record<string, string> = {};
    for (const id of ids) {
      const party = await this.directory.get(id);
      if (party) names[id] = party.displayName;
    }
    return names;
  }
}

/** The due date the standing origination stated. Null when it stated none. */
function dueAtOf(position: PositionLifecycle): string | null {
  const origination = position.events.find((e) => e.relation === "originates" && !e.retracted);
  return origination?.dueAt ?? null;
}

/** An unknown balance is not settled: it stays actionable, so the gap can still be worked on. */
const isOpen = (balance: string | null): boolean => balance === null || toCents(balance) > 0n;
