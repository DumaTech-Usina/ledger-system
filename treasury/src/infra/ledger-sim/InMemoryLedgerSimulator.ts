import { randomUUID } from "crypto";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../core/application/ports/CandidateSubmissionPort";
import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { PositionLifecyclePort } from "../../core/application/ports/PositionLifecyclePort";
import type { PositionCandidate, PositionLookupPort } from "../../core/application/ports/PositionLookupPort";
import type { LedgerEventLookupPort } from "../../core/application/ports/LedgerEventLookupPort";
import type {
  BookExposure,
  CashPosition,
  CashMovementsPage,
  PositionsPage,
  CashMovement,
  PositionItem,
  PositionLifecycle,
  LedgerEventRef,
} from "../../core/application/dtos/LedgerReadModels";

/**
 * DEMO-ONLY in-memory stand-in for the whole Ledger. Implements BOTH the submission boundary and
 * the read boundary against one store, so an accepted intent shows up in the dashboards
 * immediately — letting you validate the full create → submit → see-in-dashboard loop without a
 * running Ledger.
 *
 * This is NOT the real Ledger: no invariant matrices, no hash chain, no economic validation beyond
 * the same stub rules used by StubCandidateSubmissionAdapter. When the integration contract lands,
 * the real submission adapter + real Ledger reads replace it. Enable with LEDGER_MODE=simulate.
 */

/** Parses a decimal money string ("1500.00", "+419500.00") into integer cents. */
function toCents(s: string): bigint {
  const negative = s.trim().startsWith("-");
  const [intPart, decPart = ""] = s.trim().replace(/^[+-]/, "").split(".");
  const cents = BigInt(intPart || "0") * 100n + BigInt((decPart + "00").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

const isoDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString();

interface RecordInput {
  effect: string;
  amount: string;
  currency: string;
  occurredAt: string;
  objectType: string;
  sourceReference: string;
  counterparty: string | null;
  description: string | null;
}

export class InMemoryLedgerSimulator implements CandidateSubmissionPort, LedgerReadPort, PositionLifecyclePort, PositionLookupPort, LedgerEventLookupPort {
  private readonly movementStore: CashMovement[] = [];
  private readonly positionStore: PositionItem[] = [];
  private readonly seen = new Set<string>();
  private currency = "BRL";
  private seq = 0;

  constructor() {
    // A little seeded history so the dashboard isn't empty before the first intent.
    this.record({ effect: "cash_in", amount: "88000.00", currency: "BRL", occurredAt: isoDay(2026, 6, 5), objectType: "charge", sourceReference: "charge:seed-1", counterparty: "Grão Verde", description: "Cobrança — Grão Verde" });
    this.record({ effect: "cash_out", amount: "15750.00", currency: "BRL", occurredAt: isoDay(2026, 6, 6), objectType: "purchase", sourceReference: "purchase:seed-2", counterparty: "Fornecedor Sul", description: "Compra — Fornecedor Sul" });
  }

  // ── Submission boundary ────────────────────────────────────────────────────
  async submit(candidate: Candidate): Promise<SubmissionOutcome> {
    if (this.seen.has(candidate.sourceReference)) {
      return {
        status: "rejected",
        reason: "Duplicate: this intent was already submitted to the Ledger.",
        rejections: [{ code: "DUPLICATE", category: "duplicate", detail: "This entry was already recorded." }],
      };
    }
    if ((candidate.description ?? "").toLowerCase().includes("test")) {
      return {
        status: "rejected",
        reason: "Flagged for manual review (description contains 'test').",
        rejections: [{ code: "TUPLE_INVALID", category: "internal", detail: "This operation could not be recorded automatically and was routed for review." }],
      };
    }
    this.seen.add(candidate.sourceReference);
    const ledgerReference = this.record({
      effect: candidate.economicEffect,
      amount: candidate.amount,
      currency: candidate.currency,
      occurredAt: candidate.occurredAt,
      objectType: candidate.objects[0]?.objectType ?? "unknown",
      sourceReference: candidate.sourceReference,
      counterparty: candidate.parties.find((p) => p.direction === "neutral")?.partyId ?? null,
      description: candidate.description ?? null,
    });
    return { status: "accepted", ledgerReference };
  }

  private record(input: RecordInput): string {
    this.currency = input.currency || this.currency;
    const ledgerReference = `evt_${(++this.seq).toString().padStart(4, "0")}_${randomUUID().slice(0, 4)}`;
    this.movementStore.unshift({
      eventId: ledgerReference,
      occurredAt: input.occurredAt,
      recordedAt: new Date().toISOString(),
      effect: input.effect,
      amount: input.amount,
      sourceReference: input.sourceReference,
      counterparty: input.counterparty,
      description: input.description,
    });
    this.positionStore.unshift({
      objectId: input.sourceReference,
      objectType: input.objectType,
      status: "open",
      outcome: "pending",
      currency: input.currency,
      totalOriginated: input.amount,
      openBalance: input.amount,
      eventCount: 1,
      lastEventAt: input.occurredAt, originatedAt: null, createdAt: input.occurredAt, dueAt: null,
    });
    return ledgerReference;
  }

  // ── Read boundary ──────────────────────────────────────────────────────────
  async cashPosition(): Promise<CashPosition> {
    let cashIn = 0n;
    let cashOut = 0n;
    for (const m of this.movementStore) {
      const cents = toCents(m.amount);
      if (m.effect === "cash_in") cashIn += cents;
      else if (m.effect === "cash_out") cashOut += cents;
    }
    const net = cashIn - cashOut;
    const sign = net >= 0n ? "+" : "-";
    return {
      totalCashIn: fromCents(cashIn),
      totalCashOut: fromCents(cashOut),
      netCashFlow: `${sign}${fromCents(net >= 0n ? net : -net)}`,
      openReceivables: fromCents(cashIn), // demo simplification: charges recorded as receivables
      contingentExposure: "0.00",
      currency: this.currency,
      asOf: new Date().toISOString(),
    };
  }

  async cashMovements(params?: { partyId?: string; effect?: string; limit?: number }): Promise<CashMovementsPage> {
    // The direction filter is honoured so the demo does not contradict the real adapter on screen.
    // Party and period are not: this store keys a movement per submission and holds no cast to scope
    // by, so it answers the wider question rather than a filtered fiction.
    const items = this.movementStore.filter((m) => !params?.effect || m.effect === params.effect);
    return { items: items.slice(0, params?.limit ?? 50), nextCursor: null, hasMore: false };
  }

  async positions(params?: { limit?: number; page?: number }): Promise<PositionsPage> {
    const limit = params?.limit ?? 50;
    const page = params?.page ?? 1;
    const data = this.positionStore.slice((page - 1) * limit, page * limit);
    return {
      data,
      total: this.positionStore.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(this.positionStore.length / limit)),
    };
  }

  /**
   * Not projected here. This store keys a position per submission (by sourceReference) and knows
   * nothing about object continuity, so any history it produced would be a fiction. Unknown is the
   * honest answer; the real lifecycle needs the real Ledger.
   */
  async lifecycle(_objectId: string): Promise<PositionLifecycle | null> {
    return null;
  }

  /** No event store behind this adapter, so no event can be looked up — and none is invented. */
  async event(_eventId: string): Promise<LedgerEventRef | null> {
    return null;
  }

  /**
   * No position store to offer from, so nothing is offered. The conversation then asks its question
   * the way it always has — an empty list is a legitimate answer, not a degraded one.
   */
  async openPositions(): Promise<PositionCandidate[]> {
    return [];
  }

  /** Same as above: a demo book offers nothing to point a recognition at. */
  async unoriginatedPositions(): Promise<PositionCandidate[]> {
    return [];
  }


  /**
   * No book to measure. Zeroes here would claim a healthy book rather than an absent one, so the
   * figures are stated as zero exposure with a zero score — and the demo adapters are never the
   * source for a real decision.
   */
  async bookExposure(): Promise<BookExposure> {
    return {
      currency: "BRL",
      openExposure: "0.00",
      openPayableExposure: "0.00",
      overduePayable: "0.00",
      upcomingPayable: "0.00",
      undatedPayable: "0.00",
      capitalAtRisk: "0.00",
      healthScore: {
        score: 0,
        label: "healthy",
        trend: "stable",
        trendDelta: 0,
        closureQuality: 0,
        openBookHealth: 0,
        windowDays: 90,
      },
    };
  }

}
