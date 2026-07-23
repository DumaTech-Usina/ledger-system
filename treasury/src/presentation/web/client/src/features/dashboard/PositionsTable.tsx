import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { useLanguage } from "@/i18n/i18n";
import { formatMoney } from "@/utils/format";
import type { PositionItem } from "@/types/dashboard";

const PAGE_SIZE = 10;

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PositionsTable({ positions, currency }: { positions: PositionItem[]; currency: string }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PositionItem | null>(null);

  useEffect(() => {
    setPage(1);
  }, [positions]);

  const totalPages = Math.max(1, Math.ceil(positions.length / PAGE_SIZE));
  const pageRows = positions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{t.dashboard.table.type}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.status}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.openBalance}</Table.HeaderCell>
            <Table.HeaderCell aria-hidden />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {positions.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={4} className="text-center text-muted">
                {t.common.noRecords}
              </Table.Cell>
            </Table.Row>
          ) : (
            pageRows.map((p) => (
              <Table.Row key={p.objectId}>
                <Table.Cell className="text-muted">{t.objectType[p.objectType] ?? p.objectType}</Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">{t.positionStatus[p.status] ?? p.status}</Badge>
                </Table.Cell>
                <Table.Cell mono>{formatMoney(p.openBalance, p.currency || currency)}</Table.Cell>
                <Table.Cell>
                  <button
                    type="button"
                    aria-label={t.common.viewDetails}
                    title={t.common.viewDetails}
                    onClick={() => setSelected(p)}
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
      {selected && <RowDetailModal position={selected} currency={currency} onClose={() => setSelected(null)} />}
    </div>
  );
}
