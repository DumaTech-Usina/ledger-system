import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { runningBalances } from "@/features/dashboard/cashBalance";
import { useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

const PAGE_SIZE = 10;

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export interface MovementsTableProps {
  movements: CashMovement[];
  currency: string;
  /** partyId → display name. A party absent here keeps its id: unknown is shown as unknown. */
  partyNames?: Record<string, string>;
  /**
   * Adds the running cash-balance column. Off by default, and deliberately so: a balance only means
   * something over a complete run of movements. On a list filtered to one direction — the cash-in
   * and cash-out drill-downs — it would accumulate half the story and read as the cash balance,
   * which it would not be.
   */
  showBalance?: boolean;
  /**
   * What the balance stood at before the first of these movements. Zero is right when the list
   * starts at the beginning of the book; a caller holding a later window must say where it opened.
   */
  openingBalance?: string;
  /**
   * Off when the caller already asked the Ledger for one page and owns the pager itself. Slicing
   * again here would page a page — the same rule {@link PositionsTable} follows.
   */
  paginate?: boolean;
}

export function MovementsTable({
  movements,
  currency,
  partyNames = {},
  showBalance = false,
  openingBalance = "0",
  paginate = true,
}: MovementsTableProps) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CashMovement | null>(null);

  // Over the whole list, never the visible page: a balance is what everything before it adds up to,
  // so paging must not restart the accumulation.
  const balances = useMemo(
    () => (showBalance ? runningBalances(movements, openingBalance) : null),
    [movements, openingBalance, showBalance],
  );

  useEffect(() => {
    setPage(1);
  }, [movements]);

  /** What a person would call this line. Falls back to the effect's own name — never to an id. */
  const describe = (m: CashMovement) => m.description ?? t.cashEffect[m.effect] ?? m.effect;

  /** The Ledger's own category for the fact, in the system's language — never a raw untranslated
   * key: a type the app has no name for yet still shows the Ledger's own word, and absent (a
   * Ledger that predates the field) is its own dash, not blank. */
  const eventTypeLabel = (m: CashMovement) =>
    m.eventType ? (t.eventType[m.eventType] ?? m.eventType) : "—";

  const nameOf = (partyId: string | null) => (partyId ? partyNames[partyId] ?? partyId : "—");

  const totalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE));
  const pageRows = paginate ? movements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : movements;

  return (
    <div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{t.dashboard.table.date}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.eventType}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.whatHappened}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.counterparty}</Table.HeaderCell>
            <Table.HeaderCell className="text-right">{t.dashboard.table.cashInColumn}</Table.HeaderCell>
            <Table.HeaderCell className="text-right">{t.dashboard.table.cashOutColumn}</Table.HeaderCell>
            {showBalance && (
              <Table.HeaderCell className="text-right">{t.dashboard.table.balanceColumn}</Table.HeaderCell>
            )}
            <Table.HeaderCell aria-hidden />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {movements.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={showBalance ? 8 : 7} className="text-center text-muted">
                {t.common.noRecords}
              </Table.Cell>
            </Table.Row>
          ) : (
            pageRows.map((m) => (
              <Table.Row key={m.eventId}>
                <Table.Cell mono className="text-muted">
                  {formatDate(m.occurredAt)}
                </Table.Cell>
                <Table.Cell className={m.eventType ? "text-muted" : "text-muted/60"}>{eventTypeLabel(m)}</Table.Cell>
                <Table.Cell className="text-ink">{describe(m)}</Table.Cell>
                <Table.Cell className="text-muted">{nameOf(m.counterparty)}</Table.Cell>
                {/* Direction as position: a movement lands in the column that matches what it did
                    to the cash, and the other side stays empty. A movement that moved no cash —
                    cash_internal, non_cash, contingent — fills neither, and its figure is in the
                    detail behind the row; putting it in one of these columns would state that money
                    came in or went out when none did. */}
                <Table.Cell mono className="text-right font-semibold text-ok">
                  {m.effect === "cash_in" ? formatMoney(m.amount, currency) : ""}
                </Table.Cell>
                <Table.Cell mono className="text-right font-semibold text-bad">
                  {m.effect === "cash_out" ? formatMoney(m.amount, currency) : ""}
                </Table.Cell>
                {/* The cash balance standing right after this movement. Unknown rather than blank
                    when it could not be derived — a blank would read as zero cash. */}
                {showBalance && (
                  <Table.Cell
                    mono
                    className={`text-right font-semibold ${
                      balances?.get(m.eventId) == null ? "text-muted" : "text-ink"
                    }`}
                  >
                    {(() => {
                      const balance = balances?.get(m.eventId);
                      return balance == null ? t.common.unknown : formatMoney(balance, currency);
                    })()}
                  </Table.Cell>
                )}
                <Table.Cell>
                  <button
                    type="button"
                    aria-label={t.common.viewDetails}
                    title={t.common.viewDetails}
                    onClick={() => setSelected(m)}
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink dark:hover:bg-white/10"
                  >
                    <EyeIcon />
                  </button>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
      {paginate && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      {selected && (
        <RowDetailModal
          movement={selected}
          currency={currency}
          partyNames={partyNames}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
