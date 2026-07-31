import { useEffect, useState } from "react";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
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
}

export function MovementsTable({ movements, currency }: MovementsTableProps) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CashMovement | null>(null);

  useEffect(() => {
    setPage(1);
  }, [movements]);

  const totalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE));
  const pageRows = movements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{t.dashboard.table.date}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.description}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.document}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.cashInColumn}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.cashOutColumn}</Table.HeaderCell>
            <Table.HeaderCell aria-hidden />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {movements.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={6} className="text-center text-muted">
                {t.common.noRecords}
              </Table.Cell>
            </Table.Row>
          ) : (
            pageRows.map((m) => (
              <Table.Row key={m.eventId}>
                <Table.Cell mono className="text-muted">
                  {formatDate(m.occurredAt)}
                </Table.Cell>
                <Table.Cell>{m.description ?? m.counterparty ?? "—"}</Table.Cell>
                <Table.Cell mono className="text-muted">
                  {m.sourceReference}
                </Table.Cell>
                <Table.Cell mono className={m.effect === "cash_in" ? "text-ok" : "text-muted"}>
                  {m.effect === "cash_in" ? formatMoney(m.amount, currency) : "—"}
                </Table.Cell>
                <Table.Cell mono className={m.effect === "cash_out" ? "text-bad" : "text-muted"}>
                  {m.effect === "cash_out" ? formatMoney(m.amount, currency) : "—"}
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
      {selected && <RowDetailModal movement={selected} currency={currency} onClose={() => setSelected(null)} />}
    </div>
  );
}
