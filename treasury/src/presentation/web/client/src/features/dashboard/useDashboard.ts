import { useMemo } from "react";
import { buildTreasuryDashboard } from "@/features/dashboard/data/buildDashboard";
import type { TreasuryDashboard } from "@/types/dashboard";

/** Purely local/hardcoded — no API call, so the dashboard is always available and loads instantly. */
export function useDashboard(range?: { from: string | null; to: string | null }) {
  const from = range?.from ?? null;
  const to = range?.to ?? null;

  const data: TreasuryDashboard = useMemo(() => buildTreasuryDashboard({ from, to }), [from, to]);

  return { data, loading: false };
}
