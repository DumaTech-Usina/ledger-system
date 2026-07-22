import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import { useLanguage } from "@/i18n/i18n";
import { formatMoney } from "@/utils/format";
import type { PositionItem } from "@/types/dashboard";

export function PositionsTable({ positions, currency }: { positions: PositionItem[]; currency: string }) {
  const { t } = useLanguage();

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>{t.dashboard.table.type}</Table.HeaderCell>
          <Table.HeaderCell>{t.dashboard.table.status}</Table.HeaderCell>
          <Table.HeaderCell>{t.dashboard.table.openBalance}</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {positions.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={3} className="text-center text-muted">
              {t.common.noRecords}
            </Table.Cell>
          </Table.Row>
        ) : (
          positions.map((p) => (
            <Table.Row key={p.objectId}>
              <Table.Cell className="text-muted">{t.objectType[p.objectType] ?? p.objectType}</Table.Cell>
              <Table.Cell>
                <Badge variant="neutral">{t.positionStatus[p.status] ?? p.status}</Badge>
              </Table.Cell>
              <Table.Cell mono>{formatMoney(p.openBalance, p.currency || currency)}</Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}
