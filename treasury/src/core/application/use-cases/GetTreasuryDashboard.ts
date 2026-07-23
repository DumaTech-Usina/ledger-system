import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { CashPosition, CashMovement, PositionItem } from "../dtos/LedgerReadModels";
import { computeClassificationHealth, type ClassificationHealth } from "../services/classificationHealth";

/** Positions/movements fetched to compute totals; small enough demo datasets that no further paging is needed. */
const HEALTH_SCAN_LIMIT = 500;
const MOVEMENTS_SCAN_LIMIT = 500;
const DEFAULT_MOVEMENTS_LIMIT = 50;

export interface DashboardPeriod {
  from: string | null;
  to: string | null;
  /** Cumulative balance of all movements strictly before `from`; null when no `from` was given. */
  openingBalance: string | null;
}

export interface TreasuryDashboard {
  /** False when the Ledger could not be reached — the UI shows an unavailable notice. */
  available: boolean;
  cashPosition: CashPosition | null;
  movements: CashMovement[] | null;
  positions: PositionItem[] | null;
  /** Generic/uncategorized-payment governance signal; null when the Ledger is unreachable. */
  classificationHealth: ClassificationHealth | null;
  period: DashboardPeriod | null;
}

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

/**
 * Composes the treasury dashboard from Ledger reads. If the Ledger is unreachable, degrades to an
 * `available: false` payload instead of failing — the User App must tolerate the Ledger being down.
 */
export class GetTreasuryDashboardUseCase {
  constructor(
    private readonly ledger: LedgerReadPort,
    private readonly usinaPartyId: string,
  ) {}

  async execute(params?: { from?: string; to?: string }): Promise<TreasuryDashboard> {
    const from = params?.from;
    const to = params?.to;
    try {
      const [defaultCashPosition, movementsPage, positionsPage] = await Promise.all([
        this.ledger.cashPosition(),
        this.ledger.cashMovements({
          partyId: this.usinaPartyId,
          limit: from || to ? MOVEMENTS_SCAN_LIMIT : DEFAULT_MOVEMENTS_LIMIT,
          from,
          to,
        }),
        this.ledger.positions({ limit: HEALTH_SCAN_LIMIT, asOf: to }),
      ]);
      const classificationHealth = computeClassificationHealth(positionsPage.data, positionsPage.total, new Date());

      let cashPosition = defaultCashPosition;
      let openingBalance: string | null = null;
      if (from || to) {
        let cashIn = 0n;
        let cashOut = 0n;
        for (const m of movementsPage.items) {
          const cents = toCents(m.amount);
          if (m.effect === "cash_in") cashIn += cents;
          else if (m.effect === "cash_out") cashOut += cents;
        }
        let openReceivables = 0n;
        let openPayables = 0n;
        for (const p of positionsPage.data) {
          if (p.status !== "open" && p.status !== "partially_settled") continue;
          if (p.objectType === "commission_payable") openPayables += toCents(p.openBalance);
          else openReceivables += toCents(p.openBalance);
        }
        const net = cashIn - cashOut;
        cashPosition = {
          ...defaultCashPosition,
          totalCashIn: fromCents(cashIn),
          totalCashOut: fromCents(cashOut),
          netCashFlow: `${net >= 0n ? "+" : "-"}${fromCents(net >= 0n ? net : -net)}`,
          openReceivables: fromCents(openReceivables),
          openPayables: fromCents(openPayables),
          asOf: to ? new Date(`${to}T00:00:00.000Z`).toISOString() : defaultCashPosition.asOf,
        };

        if (from) {
          const priorMovements = await this.ledger.cashMovements({
            partyId: this.usinaPartyId,
            limit: MOVEMENTS_SCAN_LIMIT,
            to: dayBefore(from),
          });
          let prior = 0n;
          for (const m of priorMovements.items) {
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
        movements: movementsPage.items,
        positions: positionsPage.data,
        classificationHealth,
        period: { from: from ?? null, to: to ?? null, openingBalance },
      };
    } catch {
      return {
        available: false,
        cashPosition: null,
        movements: null,
        positions: null,
        classificationHealth: null,
        period: null,
      };
    }
  }
}
