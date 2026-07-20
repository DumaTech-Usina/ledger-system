import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import { cashEffectLabels } from "@/features/dashboard/copy";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

const badgeVariant = (effect: string): "ok" | "bad" | "neutral" => {
  if (effect === "cash_in") return "ok";
  if (effect === "cash_out") return "bad";
  return "neutral";
};

export function MovementsTable({ movements, currency }: { movements: CashMovement[]; currency: string }) {
  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Data</Table.HeaderCell>
          <Table.HeaderCell>Data do registro</Table.HeaderCell>
          <Table.HeaderCell>Tipo</Table.HeaderCell>
          <Table.HeaderCell>Valor</Table.HeaderCell>
          <Table.HeaderCell>Contraparte</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {movements.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={5} className="text-center text-muted">
              Nenhum registro.
            </Table.Cell>
          </Table.Row>
        ) : (
          movements.map((m) => (
            <Table.Row key={m.eventId}>
              <Table.Cell mono className="text-muted">
                {formatDate(m.occurredAt)}
              </Table.Cell>
              <Table.Cell mono className="text-muted">
                {formatDate(m.recordedAt)}
              </Table.Cell>
              <Table.Cell>
                <Badge variant={badgeVariant(m.effect)}>{cashEffectLabels[m.effect] ?? m.effect}</Badge>
              </Table.Cell>
              <Table.Cell mono>{formatMoney(m.amount, currency)}</Table.Cell>
              <Table.Cell>{m.counterparty ?? "—"}</Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}
