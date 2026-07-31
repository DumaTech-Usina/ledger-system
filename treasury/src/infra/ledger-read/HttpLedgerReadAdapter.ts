import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { PositionLifecyclePort } from "../../core/application/ports/PositionLifecyclePort";
import type {
  CashPosition,
  CashMovementsPage,
  PositionsPage,
  PositionItem,
  PositionLifecycle,
} from "../../core/application/dtos/LedgerReadModels";

/** The Ledger's position-detail payload, as `serializePositionSummary` emits it. */
interface LedgerPositionDetail {
  objectId: string;
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  totalSettled: string;
  openBalance: string;
  eventCount: number;
  events: Array<{
    id: string;
    eventType: string;
    economicEffect: string;
    amount: string;
    currency: string;
    occurredAt: string;
    recordedAt: string;
    description: string | null;
    objects: Array<{ objectId: string; relation: string }>;
  }>;
}

/**
 * Reads the Ledger's published read API over HTTP. Uses Node's global fetch (no dependency) with a
 * timeout so a slow/hung Ledger can't hang a treasury request.
 */
export class HttpLedgerReadAdapter implements LedgerReadPort, PositionLifecyclePort {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken = "",
    private readonly timeoutMs = 4000,
  ) {}

  private async request<T>(path: string, nullOn404: boolean): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (this.serviceToken) headers["authorization"] = `Bearer ${this.serviceToken}`;
      const res = await fetch(this.baseUrl + path, { headers, signal: controller.signal });
      if (nullOn404 && res.status === 404) return null;
      if (!res.ok) throw new Error(`Ledger read failed (${res.status}) for ${path}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    return (await this.request<T>(path, false)) as T;
  }

  /** For resources the Ledger may legitimately not know: 404 comes back as `null`, never as a throw. */
  private getOrNull<T>(path: string): Promise<T | null> {
    return this.request<T>(path, true);
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

  /**
   * The life of one economic object, from the Ledger's own position projection. The event order is
   * the Ledger's (recordedAt ascending) and is passed through untouched; each event is trimmed to
   * the fields treasury displays, plus the relation it declares for THIS object.
   */
  async lifecycle(objectId: string): Promise<PositionLifecycle | null> {
    const raw = await this.getOrNull<LedgerPositionDetail>(`/api/positions/${encodeURIComponent(objectId)}`);
    if (!raw) return null;

    return {
      objectId: raw.objectId,
      status: raw.status,
      outcome: raw.outcome,
      currency: raw.currency,
      totalOriginated: raw.totalOriginated,
      totalSettled: raw.totalSettled,
      openBalance: raw.openBalance,
      eventCount: raw.eventCount,
      events: (raw.events ?? []).map((e) => ({
        eventId: e.id,
        eventType: e.eventType,
        economicEffect: e.economicEffect,
        relation: e.objects?.find((o) => o.objectId === raw.objectId)?.relation ?? null,
        amount: e.amount,
        currency: e.currency,
        occurredAt: e.occurredAt,
        recordedAt: e.recordedAt,
        description: e.description,
      })),
    };
  }
}
