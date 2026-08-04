import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { PositionLifecyclePort } from "../../core/application/ports/PositionLifecyclePort";
import type { LedgerEventLookupPort } from "../../core/application/ports/LedgerEventLookupPort";
import type { CashPosition, CashMovementsPage, PositionsPage, PositionLifecycle, LedgerEventRef } from "../../core/application/dtos/LedgerReadModels";

/**
 * Offline/demo adapter returning representative figures in the Ledger's raw money format
 * ("1250000.00"), so display formatting behaves identically to the real HTTP adapter. Selected via
 * LEDGER_READS=stub when no Ledger is reachable.
 */
export class StubLedgerReadAdapter implements LedgerReadPort, PositionLifecyclePort, LedgerEventLookupPort {
  /**
   * An object's life is projected from a real event chain, which this adapter does not have. It
   * answers "unknown" rather than inventing a history — a fabricated lifecycle would be worse than
   * no lifecycle. Reachable only with a real Ledger behind LEDGER_READS=http.
   */
  async lifecycle(_objectId: string): Promise<PositionLifecycle | null> {
    return null;
  }

  /** No event store behind this adapter, so no event can be looked up — and none is invented. */
  async event(_eventId: string): Promise<LedgerEventRef | null> {
    return null;
  }

  async cashPosition(): Promise<CashPosition> {
    return {
      totalCashIn: "1250000.00",
      totalCashOut: "830500.00",
      netCashFlow: "+419500.00",
      openReceivables: "215000.00",
      contingentExposure: "48000.00",
      currency: "BRL",
      asOf: new Date().toISOString(),
    };
  }

  async cashMovements(): Promise<CashMovementsPage> {
    const day = (d: number) => new Date(Date.UTC(2026, 6, d)).toISOString();
    return {
      items: [
        { eventId: "e1", occurredAt: day(9), recordedAt: day(9), effect: "cash_in", amount: "42000.00", sourceReference: "charge:1001", counterparty: "ACME Foods", description: "Cobrança — ACME Foods" },
        { eventId: "e2", occurredAt: day(8), recordedAt: day(8), effect: "cash_out", amount: "15750.00", sourceReference: "purchase:2002", counterparty: "Fornecedor Sul", description: "Compra — Fornecedor Sul" },
        { eventId: "e3", occurredAt: day(7), recordedAt: day(7), effect: "cash_in", amount: "88000.00", sourceReference: "charge:1000", counterparty: "Grão Verde", description: "Cobrança — Grão Verde" },
        { eventId: "e4", occurredAt: day(6), recordedAt: day(6), effect: "cash_out", amount: "9300.00", sourceReference: "advance:3003", counterparty: "corretor", description: "Adiantamento — corretor" },
      ],
      nextCursor: null,
      hasMore: false,
    };
  }

  async positions(): Promise<PositionsPage> {
    const at = (mo: number, d: number) => new Date(Date.UTC(2026, mo, d)).toISOString();
    return {
      total: 5,
      data: [
        { objectId: "charge:1001", objectType: "charge", status: "open", outcome: "pending", currency: "BRL", totalOriginated: "42000.00", openBalance: "42000.00", eventCount: 1, lastEventAt: at(6, 9) },
        { objectId: "charge:1000", objectType: "charge", status: "partially_settled", outcome: "pending", currency: "BRL", totalOriginated: "120000.00", openBalance: "32000.00", eventCount: 3, lastEventAt: at(6, 7) },
        { objectId: "advance:3003", objectType: "advance", status: "fully_settled", outcome: "gain", currency: "BRL", totalOriginated: "9300.00", openBalance: "0.00", eventCount: 2, lastEventAt: at(6, 6) },
        // Two generic/uncategorized payments (objectType "payable") — one recent, one stale — so the
        // classification-health panel shows a representative backlog in demo mode.
        { objectId: "intent:p-88", objectType: "payable", status: "open", outcome: "pending", currency: "BRL", totalOriginated: "0.00", openBalance: "0.00", eventCount: 1, lastEventAt: at(6, 5) },
        { objectId: "intent:p-42", objectType: "payable", status: "open", outcome: "pending", currency: "BRL", totalOriginated: "0.00", openBalance: "0.00", eventCount: 1, lastEventAt: at(2, 2) },
      ],
    };
  }
}
