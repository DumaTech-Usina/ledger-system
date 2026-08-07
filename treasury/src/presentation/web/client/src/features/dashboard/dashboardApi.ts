import { apiGet } from "@/api/client";
import type {
  BookExposureResult,
  ListPositionsResult,
  PayablePositionsResult,
  PositionLifecycle,
  TreasuryDashboard,
} from "@/types/dashboard";

/** 404 means the Ledger knows no such object — a legitimate answer, carried here as its body. */
interface NotFoundBody {
  error: string;
}

export const dashboardApi = {
  overview: () => apiGet<TreasuryDashboard>("/api/dashboard/overview"),
  /** The position math over the whole book — exposure, capital at risk, book health. */
  exposure: () => apiGet<BookExposureResult>("/api/dashboard/exposure"),
  /** A page of positions, paged by the Ledger. Distinct from the fixed slice in `overview`. */
  positions: (page: number) => apiGet<ListPositionsResult>(`/api/dashboard/positions?page=${page}`),
  /** The payable positions behind the upcoming/overdue figures, split by the server. */
  payables: () => apiGet<PayablePositionsResult>("/api/dashboard/payables"),
  objectLifecycle: (objectId: string) =>
    apiGet<PositionLifecycle | NotFoundBody>(`/api/dashboard/positions/${encodeURIComponent(objectId)}`),
};
