import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import { positionStatusLabels } from "@/features/dashboard/copy";
import { formatMoney } from "@/utils/format";
import type { PositionItem } from "@/types/dashboard";

export function PositionsTable({ positions, currency }: { positions: PositionItem[]; currency: string }) {
  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Objeto</Table.HeaderCell>
          <Table.HeaderCell>Situação</Table.HeaderCell>
          <Table.HeaderCell>Saldo em aberto</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {positions.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={3} className="text-center text-muted">
              Nenhum registro.
            </Table.Cell>
          </Table.Row>
        ) : (
          positions.map((p) => (
            <Table.Row key={p.objectId}>
              <Table.Cell mono className="text-muted">
                {p.objectId}
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral">{positionStatusLabels[p.status] ?? p.status}</Badge>
              </Table.Cell>
              <Table.Cell mono>{formatMoney(p.openBalance, p.currency || currency)}</Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}
