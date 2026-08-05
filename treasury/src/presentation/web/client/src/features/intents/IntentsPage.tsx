import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { IntentHistoryModal } from "@/features/intents/IntentHistoryModal";
import { useIntents } from "@/features/intents/useIntents";
import { scenarioCopy } from "@/features/operations/copy";
import { useLanguage } from "@/i18n/i18n";
import { formatDateTime } from "@/utils/format";
import type { IntentStatus, IntentSummary } from "@/types/operations";

const PAGE_SIZE = 10;

/** Settled one way or the other; anything else is still moving, and the dot says so. */
const badgeVariant = (status: IntentStatus): "neutral" | "ok" | "bad" | "warn" => {
  if (status === "accepted") return "ok";
  if (status === "rejected") return "bad";
  if (status === "draft") return "neutral";
  return "warn";
};

const isSettled = (status: IntentStatus) => status === "accepted" || status === "rejected";

export function IntentsPage() {
  const { t } = useLanguage();
  const { intents, loading } = useIntents();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<IntentSummary | null>(null);

  const rows = intents ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{t.intents.heading}</h2>
        <p className="mt-1 text-sm text-muted">{t.intents.subheading}</p>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-muted">{t.common.loading}</p>
        </Card>
      ) : (
        <Card padding="none">
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>{t.intents.operation}</Table.HeaderCell>
                <Table.HeaderCell>{t.intents.status}</Table.HeaderCell>
                <Table.HeaderCell>{t.intents.updatedAt}</Table.HeaderCell>
                <Table.HeaderCell aria-hidden />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4} className="text-center text-muted">
                    {t.common.noRecords}
                  </Table.Cell>
                </Table.Row>
              ) : (
                pageRows.map((intent) => (
                  <Table.Row key={intent.id}>
                    <Table.Cell className="text-ink">
                      {scenarioCopy[intent.scenarioId]?.title ?? intent.scenarioTitle}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        variant={badgeVariant(intent.status)}
                        dot={isSettled(intent.status) ? true : "pulse"}
                      >
                        {t.intentStatus[intent.status] ?? intent.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell mono className="text-muted">
                      {formatDateTime(intent.updatedAt)}
                    </Table.Cell>
                    <Table.Cell>
                      <button
                        type="button"
                        onClick={() => setSelected(intent)}
                        className="text-[13px] font-semibold text-accent transition hover:underline"
                      >
                        {t.intents.historyTitle}
                      </button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </Card>
      )}

      {selected && (
        <IntentHistoryModal
          intentId={selected.id}
          title={scenarioCopy[selected.scenarioId]?.title ?? selected.scenarioTitle}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
