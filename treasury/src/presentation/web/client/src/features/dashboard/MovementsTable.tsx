import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import { useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

const badgeVariant = (effect: string): "ok" | "bad" | "neutral" => {
  if (effect === "cash_in") return "ok";
  if (effect === "cash_out") return "bad";
  return "neutral";
};

export function MovementsTable({ movements, currency }: { movements: CashMovement[]; currency: string }) {
  const { t } = useLanguage();

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>{t.dashboard.table.date}</Table.HeaderCell>
          <Table.HeaderCell>{t.dashboard.table.recordedDate}</Table.HeaderCell>
          <Table.HeaderCell>{t.dashboard.table.type}</Table.HeaderCell>
          <Table.HeaderCell>{t.dashboard.table.amount}</Table.HeaderCell>
          <Table.HeaderCell>{t.dashboard.table.counterparty}</Table.HeaderCell>
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
          movements.map((m) => (
            <Table.Row key={m.eventId}>
              <Table.Cell mono className="text-muted">
                {formatDate(m.occurredAt)}
              </Table.Cell>
              <Table.Cell mono className="text-muted">
                {formatDate(m.recordedAt)}
              </Table.Cell>
              <Table.Cell>
                <Badge variant={badgeVariant(m.effect)}>{t.cashEffect[m.effect] ?? m.effect}</Badge>
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
