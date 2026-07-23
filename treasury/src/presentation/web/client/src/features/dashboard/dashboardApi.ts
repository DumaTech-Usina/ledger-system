import { apiGet } from "@/api/client";
import type { TreasuryDashboard } from "@/types/dashboard";

export const dashboardApi = {
  overview: (range?: { from?: string | null; to?: string | null }) => {
    const q = new URLSearchParams();
    if (range?.from) q.set("from", range.from);
    if (range?.to) q.set("to", range.to);
    const qs = q.toString();
    return apiGet<TreasuryDashboard>(`/api/dashboard/overview${qs ? `?${qs}` : ""}`);
  },
};
