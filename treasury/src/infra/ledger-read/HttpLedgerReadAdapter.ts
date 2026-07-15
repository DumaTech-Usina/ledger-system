import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type {
  CashPosition,
  CashMovementsPage,
  PositionsPage,
  PositionItem,
} from "../../core/application/dtos/LedgerReadModels";

/**
 * Reads the Ledger's published read API over HTTP. Uses Node's global fetch (no dependency) with a
 * timeout so a slow/hung Ledger can't hang a treasury request.
 */
export class HttpLedgerReadAdapter implements LedgerReadPort {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken = "",
    private readonly timeoutMs = 4000,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (this.serviceToken) headers["authorization"] = `Bearer ${this.serviceToken}`;
      const res = await fetch(this.baseUrl + path, { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`Ledger read failed (${res.status}) for ${path}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  cashPosition(): Promise<CashPosition> {
    return this.get<CashPosition>("/api/cash-position");
  }

  cashMovements(params: { partyId: string; limit?: number }): Promise<CashMovementsPage> {
    const q = new URLSearchParams({ partyId: params.partyId, limit: String(params.limit ?? 50) });
    return this.get<CashMovementsPage>(`/api/cash-movements?${q.toString()}`);
  }

  async positions(params?: { limit?: number }): Promise<PositionsPage> {
    const q = new URLSearchParams({ limit: String(params?.limit ?? 50) });
    const raw = await this.get<{ data: PositionItem[]; total: number }>(`/api/positions?${q.toString()}`);
    // Keep only the fields treasury displays.
    return {
      total: raw.total,
      data: (raw.data ?? []).map((p) => ({
        objectId: p.objectId,
        objectType: p.objectType,
        status: p.status,
        outcome: p.outcome,
        currency: p.currency,
        totalOriginated: p.totalOriginated,
        openBalance: p.openBalance,
        eventCount: p.eventCount,
        lastEventAt: p.lastEventAt,
      })),
    };
  }
}
