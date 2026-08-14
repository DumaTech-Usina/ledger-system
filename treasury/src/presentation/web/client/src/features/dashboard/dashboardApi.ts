import { apiGet } from "@/api/client";
import type {
  BookExposureResult,
  ListCashMovementsResult,
  ListPositionsResult,
  PayablePositionsResult,
  PositionLifecycle,
  TreasuryDashboard,
} from "@/types/dashboard";

/** 404 means the Ledger knows no such object — a legitimate answer, carried here as its body. */
interface NotFoundBody {
  error: string;
}

/** Appends only the params that carry a value. An empty string or array is the same as absent. */
function toQuery(params: Record<string, string | number | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface PositionsFilterParams {
  page?: number;
  perPage?: number;
  status?: string[];
  objectType?: string[];
  /** Positions this party is involved in, in any role. */
  partyId?: string;
  outcome?: string;
  /** ISO period over when the position entered the book. */
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface MovementsFilterParams {
  /** Numbered page — the Ledger counts the filtered set. Omit for the cheaper keyset walk. */
  page?: number;
  limit?: number;
  partyId?: string;
  effect?: string;
  /** ISO period over occurrence. */
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface PeriodParams {
  /** ISO period. On `overview`, scopes the movements/positions blocks — never `cashPosition`. On
   * `exposure`, scopes only the cash figures — never the exposure totals. */
  from?: string;
  to?: string;
}

export const dashboardApi = {
  overview: (params: PeriodParams & { perPage?: number } = {}) =>
    apiGet<TreasuryDashboard>(
      `/api/dashboard/overview${toQuery({ from: params.from, to: params.to, per_page: params.perPage })}`,
    ),
  /** The position math over the whole book — exposure, capital at risk, book health, period cash. */
  exposure: (params: PeriodParams = {}) =>
    apiGet<BookExposureResult>(`/api/dashboard/exposure${toQuery({ from: params.from, to: params.to })}`),
  /** A page of positions, paged and filtered by the Ledger. */
  positions: (params: PositionsFilterParams) =>
    apiGet<ListPositionsResult>(
      `/api/dashboard/positions${toQuery({
        page: params.page,
        per_page: params.perPage,
        status: params.status,
        objectType: params.objectType,
        partyId: params.partyId,
        outcome: params.outcome,
        from: params.from,
        to: params.to,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      })}`,
    ),
  /** A page of the book's cash movements, paged and filtered by the Ledger. */
  movements: (params: MovementsFilterParams) =>
    apiGet<ListCashMovementsResult>(
      `/api/dashboard/movements${toQuery({
        page: params.page,
        limit: params.limit,
        partyId: params.partyId,
        effect: params.effect,
        from: params.from,
        to: params.to,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      })}`,
    ),
  /** The payable positions behind the upcoming/overdue figures, split by the server. */
  payables: () => apiGet<PayablePositionsResult>("/api/dashboard/payables"),
  objectLifecycle: (objectId: string) =>
    apiGet<PositionLifecycle | NotFoundBody>(`/api/dashboard/positions/${encodeURIComponent(objectId)}`),
};
