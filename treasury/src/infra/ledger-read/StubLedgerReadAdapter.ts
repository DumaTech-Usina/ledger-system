import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { CashPosition, CashMovementsPage, PositionsPage } from "../../core/application/dtos/LedgerReadModels";
import { buildDemoCommissions } from "../ledger-sim/demoCommissionData";

/**
 * Offline/demo adapter returning representative figures in the Ledger's raw money format
 * ("1250000.00"), so display formatting behaves identically to the real HTTP adapter. Selected via
 * LEDGER_READS=stub when no Ledger is reachable. Shares the same fake commission catalog as
 * InMemoryLedgerSimulator so both demo modes agree.
 */
export class StubLedgerReadAdapter implements LedgerReadPort {
  private readonly data = buildDemoCommissions();

  async cashPosition(): Promise<CashPosition> {
    let cashIn = 0;
    let cashOut = 0;
    for (const m of this.data.movements) {
      const n = Number(m.amount);
      if (m.effect === "cash_in") cashIn += n;
      else if (m.effect === "cash_out") cashOut += n;
    }
    let openReceivables = 0;
    let openPayables = 0;
    for (const p of this.data.positions) {
      if (p.status !== "open" && p.status !== "partially_settled") continue;
      if (p.objectType === "commission_payable") openPayables += Number(p.openBalance);
      else openReceivables += Number(p.openBalance);
    }
    const net = cashIn - cashOut;
    return {
      totalCashIn: cashIn.toFixed(2),
      totalCashOut: cashOut.toFixed(2),
      netCashFlow: `${net >= 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}`,
      openReceivables: openReceivables.toFixed(2),
      openPayables: openPayables.toFixed(2),
      contingentExposure: "0.00",
      currency: "BRL",
      asOf: new Date().toISOString(),
    };
  }

  async cashMovements(params: { partyId: string; limit?: number; from?: string; to?: string }): Promise<CashMovementsPage> {
    const items = this.data.movements
      .filter((m) => inRange(m.occurredAt, params.from, params.to))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { items: items.slice(0, params.limit ?? 50), nextCursor: null, hasMore: false };
  }

  async positions(params?: { limit?: number; asOf?: string }): Promise<PositionsPage> {
    const data = this.data.positions
      .filter((p) => !params?.asOf || !p.lastEventAt || p.lastEventAt.slice(0, 10) <= params.asOf)
      .sort((a, b) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
    return { total: data.length, data: data.slice(0, params?.limit ?? 50) };
  }
}

function inRange(iso: string, from?: string, to?: string): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
