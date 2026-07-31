import { apiGet } from "@/api/client";
import type { TreasuryDashboard } from "@/types/dashboard";

export const dashboardApi = {
  overview: () => apiGet<TreasuryDashboard>("/api/dashboard/overview"),
};
