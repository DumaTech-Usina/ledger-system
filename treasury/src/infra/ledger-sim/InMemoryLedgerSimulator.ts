import { randomUUID } from "crypto";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../core/application/ports/CandidateSubmissionPort";
import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { CashPosition, CashMovementsPage, PositionsPage, CashMovement, PositionItem } from "../../core/application/dtos/LedgerReadModels";
import { buildDemoCommissions } from "./demoCommissionData";

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

export class InMemoryLedgerSimulator implements CandidateSubmissionPort, LedgerReadPort {
  private readonly movementStore: CashMovement[] = [];
  private readonly positionStore: PositionItem[] = [];
  private readonly seen = new Set<string>();
  private currency = "BRL";
  private seq = 0;

  constructor() {
    const { movements, positions } = buildDemoCommissions();
    this.movementStore.push(...movements);
    this.positionStore.push(...positions);
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
      lastEventAt: input.occurredAt,
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
    let openReceivables = 0n;
    let openPayables = 0n;
    for (const p of this.positionStore) {
      if (p.status !== "open" && p.status !== "partially_settled") continue;
      if (p.objectType === "commission_payable") openPayables += toCents(p.openBalance);
      else openReceivables += toCents(p.openBalance);
    }
    const net = cashIn - cashOut;
    const sign = net >= 0n ? "+" : "-";
    return {
      totalCashIn: fromCents(cashIn),
      totalCashOut: fromCents(cashOut),
      netCashFlow: `${sign}${fromCents(net >= 0n ? net : -net)}`,
      openReceivables: fromCents(openReceivables),
      openPayables: fromCents(openPayables),
      contingentExposure: "0.00",
      currency: this.currency,
      asOf: new Date().toISOString(),
    };
  }

  async cashMovements(params: { partyId: string; limit?: number; from?: string; to?: string }): Promise<CashMovementsPage> {
    const items = this.movementStore
      .filter((m) => inRange(m.occurredAt, params.from, params.to))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { items: items.slice(0, params.limit ?? 50), nextCursor: null, hasMore: false };
  }

  async positions(params?: { limit?: number; asOf?: string }): Promise<PositionsPage> {
    const data = this.positionStore
      .filter((p) => !params?.asOf || !p.lastEventAt || p.lastEventAt.slice(0, 10) <= params.asOf)
      .sort((a, b) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
    return { data: data.slice(0, params?.limit ?? 50), total: data.length };
  }
}

/** True when the date portion of `iso` falls within the inclusive [from, to] bounds (either may be omitted). */
function inRange(iso: string, from?: string, to?: string): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
