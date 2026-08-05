import { useEffect, useState } from "react";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

const PAGE_SIZE = 10;

/**
 * The amount with the direction written into it. Money out reads as a subtraction because that is
 * what it is; anything that isn't a cash movement carries no sign, since it moved no cash.
 */
function signedAmount(movement: CashMovement, currency: string): string {
  const value = formatMoney(movement.amount, currency);
  if (movement.effect === "cash_in") return `+${value}`;
  if (movement.effect === "cash_out") return `−${value}`;
  return value;
}

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
}

export function MovementsTable({ movements, currency, partyNames = {} }: MovementsTableProps) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CashMovement | null>(null);

  useEffect(() => {
    setPage(1);
  }, [movements]);

  /** What a person would call this line. Falls back to the effect's own name — never to an id. */
  const describe = (m: CashMovement) => m.description ?? t.cashEffect[m.effect] ?? m.effect;

  const nameOf = (partyId: string | null) => (partyId ? partyNames[partyId] ?? partyId : "—");

  const totalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE));
  const pageRows = movements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{t.dashboard.table.date}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.whatHappened}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.counterparty}</Table.HeaderCell>
            <Table.HeaderCell className="text-right">{t.dashboard.table.amount}</Table.HeaderCell>
            <Table.HeaderCell aria-hidden />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {movements.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={5} className="text-center text-muted">
                {t.common.noRecords}
              </Table.Cell>
            </Table.Row>
          ) : (
            pageRows.map((m) => (
              <Table.Row key={m.eventId}>
                <Table.Cell mono className="text-muted">
                  {formatDate(m.occurredAt)}
                </Table.Cell>
                <Table.Cell className="text-ink">{describe(m)}</Table.Cell>
                <Table.Cell className="text-muted">{nameOf(m.counterparty)}</Table.Cell>
                {/* One signed column instead of two half-empty ones. The sign carries the direction,
                    so the meaning survives without colour — and every effect gets a figure, rather
                    than the non-cash ones rendering an empty row. */}
                <Table.Cell
                  mono
                  className={cn(
                    "text-right font-semibold",
                    m.effect === "cash_in" && "text-ok",
                    m.effect === "cash_out" && "text-bad",
                    m.effect !== "cash_in" && m.effect !== "cash_out" && "text-muted",
                  )}
                >
                  {signedAmount(m, currency)}
                </Table.Cell>
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
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
