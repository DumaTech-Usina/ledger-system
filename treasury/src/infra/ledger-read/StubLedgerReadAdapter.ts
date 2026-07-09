import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { CashPosition, CashMovementsPage, PositionsPage } from "../../core/application/dtos/LedgerReadModels";

/**
 * Offline/demo adapter returning representative figures in the Ledger's raw money format
 * ("1250000.00"), so display formatting behaves identically to the real HTTP adapter. Selected via
 * LEDGER_READS=stub when no Ledger is reachable.
 */
export class StubLedgerReadAdapter implements LedgerReadPort {
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
        { eventId: "e1", occurredAt: day(9), effect: "cash_in", amount: "42000.00", sourceReference: "charge:1001", description: "Cobrança — ACME Foods" },
        { eventId: "e2", occurredAt: day(8), effect: "cash_out", amount: "15750.00", sourceReference: "purchase:2002", description: "Compra — Fornecedor Sul" },
        { eventId: "e3", occurredAt: day(7), effect: "cash_in", amount: "88000.00", sourceReference: "charge:1000", description: "Cobrança — Grão Verde" },
        { eventId: "e4", occurredAt: day(6), effect: "cash_out", amount: "9300.00", sourceReference: "advance:3003", description: "Adiantamento — corretor" },
      ],
      nextCursor: null,
      hasMore: false,
    };
  }

  async positions(): Promise<PositionsPage> {
    return {
      total: 3,
      data: [
        { objectId: "charge:1001", objectType: "charge", status: "open", outcome: "pending", currency: "BRL", totalOriginated: "42000.00", openBalance: "42000.00", eventCount: 1, lastEventAt: new Date(Date.UTC(2026, 6, 9)).toISOString() },
        { objectId: "charge:1000", objectType: "charge", status: "partially_settled", outcome: "pending", currency: "BRL", totalOriginated: "120000.00", openBalance: "32000.00", eventCount: 3, lastEventAt: new Date(Date.UTC(2026, 6, 7)).toISOString() },
        { objectId: "advance:3003", objectType: "advance", status: "fully_settled", outcome: "gain", currency: "BRL", totalOriginated: "9300.00", openBalance: "0.00", eventCount: 2, lastEventAt: new Date(Date.UTC(2026, 6, 6)).toISOString() },
      ],
    };
  }
}
