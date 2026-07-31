import { buildDemoCommissions } from "@/features/dashboard/data/commissionData";
import type { ClassificationHealth, TreasuryDashboard } from "@/types/dashboard";

const UNCATEGORIZED_OBJECT_TYPE = "payable";
const AGING_FRESH_MAX_DAYS = 30;
const AGING_RECENT_MAX_DAYS = 90;

const HEALTH_SCAN_LIMIT = 500;
const MOVEMENTS_SCAN_LIMIT = 500;
const DEFAULT_MOVEMENTS_LIMIT = 50;

const { movements: allMovements, positions: allPositions } = buildDemoCommissions();

/** Parses a decimal money string ("1500.00", "+419500.00") into integer cents. */
function toCents(s: string): bigint {
  const negative = s.trim().startsWith("-");
  const [intPart, decPart = ""] = s.trim().replace(/^[+-]/, "").split(".");
  const cents = BigInt(intPart || "0") * 100n + BigInt((decPart + "00").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** True when the date portion of `iso` falls within the inclusive [from, to] bounds (either may be omitted). */
function inRange(iso: string, from?: string, to?: string): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function ageInDays(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  return days < 0 ? 0 : days;
}

function computeClassificationHealth(positions: typeof allPositions, totalPositions: number, now: Date): ClassificationHealth {
  const uncategorized = positions.filter((p) => p.objectType === UNCATEGORIZED_OBJECT_TYPE);

  const aging = { fresh: 0, recent: 0, stale: 0 };
  let oldestDays: number | null = null;

  for (const p of uncategorized) {
    const age = ageInDays(p.lastEventAt, now);
    if (age === null) continue;
    if (oldestDays === null || age > oldestDays) oldestDays = age;
    if (age <= AGING_FRESH_MAX_DAYS) aging.fresh++;
    else if (age <= AGING_RECENT_MAX_DAYS) aging.recent++;
    else aging.stale++;
  }

  const sharePercent = totalPositions > 0 ? Math.round((uncategorized.length / totalPositions) * 100) : 0;

  return { uncategorizedCount: uncategorized.length, scannedCount: positions.length, totalPositions, sharePercent, aging, oldestDays };
}

function defaultCashPosition() {
  let cashIn = 0n;
  let cashOut = 0n;
  for (const m of allMovements) {
    const cents = toCents(m.amount);
    if (m.effect === "cash_in") cashIn += cents;
    else if (m.effect === "cash_out") cashOut += cents;
  }
  let openReceivables = 0n;
  let openPayables = 0n;
  for (const p of allPositions) {
    if (p.status !== "open" && p.status !== "partially_settled") continue;
    if (p.objectType === "commission_payable") openPayables += toCents(p.openBalance);
    else openReceivables += toCents(p.openBalance);
  }
  const net = cashIn - cashOut;
  return {
    totalCashIn: fromCents(cashIn),
    totalCashOut: fromCents(cashOut),
    netCashFlow: `${net >= 0n ? "+" : "-"}${fromCents(net >= 0n ? net : -net)}`,
    openReceivables: fromCents(openReceivables),
    openPayables: fromCents(openPayables),
    contingentExposure: "0.00",
    currency: "BRL",
    asOf: new Date().toISOString(),
  };
}

/**
 * Builds the whole treasury dashboard from the hardcoded commission catalog — mirrors what the
 * backend's GetTreasuryDashboard use case used to compute, but entirely client-side: no API call,
 * no network dependency, purely derived from `commissionData.ts` for visual/demo purposes.
 */
export function buildTreasuryDashboard(range?: { from?: string | null; to?: string | null }): TreasuryDashboard {
  const from = range?.from ?? undefined;
  const to = range?.to ?? undefined;

  const movements = allMovements
    .filter((m) => inRange(m.occurredAt, from, to))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, from || to ? MOVEMENTS_SCAN_LIMIT : DEFAULT_MOVEMENTS_LIMIT);

  const positionsFiltered = allPositions
    .filter((p) => !to || !p.lastEventAt || p.lastEventAt.slice(0, 10) <= to)
    .sort((a, b) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
  const positions = positionsFiltered.slice(0, HEALTH_SCAN_LIMIT);

  const classificationHealth = computeClassificationHealth(positions, positionsFiltered.length, new Date());

  let cashPosition = defaultCashPosition();
  let openingBalance: string | null = null;

  if (from || to) {
    let cashIn = 0n;
    let cashOut = 0n;
    for (const m of movements) {
      const cents = toCents(m.amount);
      if (m.effect === "cash_in") cashIn += cents;
      else if (m.effect === "cash_out") cashOut += cents;
    }
    let openReceivables = 0n;
    let openPayables = 0n;
    for (const p of positions) {
      if (p.status !== "open" && p.status !== "partially_settled") continue;
      if (p.objectType === "commission_payable") openPayables += toCents(p.openBalance);
      else openReceivables += toCents(p.openBalance);
    }
    const net = cashIn - cashOut;
    cashPosition = {
      ...cashPosition,
      totalCashIn: fromCents(cashIn),
      totalCashOut: fromCents(cashOut),
      netCashFlow: `${net >= 0n ? "+" : "-"}${fromCents(net >= 0n ? net : -net)}`,
      openReceivables: fromCents(openReceivables),
      openPayables: fromCents(openPayables),
      asOf: to ? new Date(`${to}T00:00:00.000Z`).toISOString() : cashPosition.asOf,
    };

    if (from) {
      const priorMovements = allMovements.filter((m) => inRange(m.occurredAt, undefined, dayBefore(from)));
      let prior = 0n;
      for (const m of priorMovements) {
        const cents = toCents(m.amount);
        if (m.effect === "cash_in") prior += cents;
        else if (m.effect === "cash_out") prior -= cents;
      }
      openingBalance = fromCents(prior);
    }
  }

  return {
    available: true,
    cashPosition,
    movements,
    positions,
    classificationHealth,
    period: { from: from ?? null, to: to ?? null, openingBalance },
  };
}
