import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CopyableId } from "@/components/CopyableId";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Select } from "@/components/Select";
import { Table } from "@/components/Table";
import { POSITION_STATUSES } from "@/features/dashboard/vocabulary";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { CounterpartyPositionsModal } from "@/screens-concept/CounterpartyPositionsModal";
import { EditCounterpartyModal } from "@/screens-concept/EditCounterpartyModal";
import { useCounterparties } from "@/screens-concept/useCounterparties";
import type { PartySummary } from "@/screens-concept/partiesApi";
import { useLanguage } from "@/i18n/i18n";

/**
 * Every counterparty the Directory knows: search by name/document/id, filter down to only the ones
 * with a position in a given status, rename one, or open its financial positions — the same
 * filtered/sortable list and lifecycle detail the Positions screen offers, scoped to one party.
 */
export function CounterpartiesPage({
  canRectify = false,
  onOperationStarted,
}: {
  canRectify?: boolean;
  onOperationStarted?: (intent: AdoptedIntent) => void;
} = {}) {
  const { t } = useLanguage();
  const {
    loading,
    pageRows,
    page,
    setPage,
    totalPages,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusFilterLoading,
    statusFilterTruncated,
    rename,
  } = useCounterparties();
  const [editing, setEditing] = useState<PartySummary | null>(null);
  const [viewingPositions, setViewingPositions] = useState<PartySummary | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{t.counterparties.heading}</h2>
        <p className="mt-1 text-sm text-muted">{t.counterparties.subheading}</p>
      </div>

      <Card padding="none">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4">
          <SearchInput
            label={t.counterparties.searchLabel}
            placeholder={t.counterparties.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-64 flex-1 sm:max-w-sm"
          />
          <Select
            label={t.counterparties.statusFilterLabel}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: t.filters.all },
              ...POSITION_STATUSES.map((s) => ({ value: s, label: t.positionStatus[s] ?? s })),
            ]}
            className="min-w-48"
          />
        </div>

        {statusFilterTruncated && (
          <p className="border-b border-line px-5 py-2 text-[12px] text-muted">{t.positions.truncatedList}</p>
        )}

        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>{t.counterparties.table.name}</Table.HeaderCell>
              <Table.HeaderCell>{t.counterparties.table.id}</Table.HeaderCell>
              <Table.HeaderCell aria-hidden />
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {loading || statusFilterLoading ? (
              <Table.Row>
                <Table.Cell colSpan={3} className="text-center text-muted">
                  {t.common.loading}
                </Table.Cell>
              </Table.Row>
            ) : pageRows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={3} className="text-center text-muted">
                  {t.common.noRecords}
                </Table.Cell>
              </Table.Row>
            ) : (
              pageRows.map((party) => (
                <Table.Row key={party.partyId}>
                  <Table.Cell className="font-medium text-ink">{party.displayName}</Table.Cell>
                  <Table.Cell>
                    <CopyableId value={party.partyId} />
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="warn" size="sm" onClick={() => setEditing(party)}>
                        {t.counterparties.edit}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setViewingPositions(party)}>
                        {t.counterparties.viewPositions}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </Card>

      {editing && (
        <EditCounterpartyModal
          party={editing}
          onClose={() => setEditing(null)}
          onRenamed={(partyId, displayName) => {
            rename(partyId, displayName);
            setEditing(null);
          }}
        />
      )}

      {viewingPositions && (
        <CounterpartyPositionsModal
          party={viewingPositions}
          canRectify={canRectify}
          onOperationStarted={onOperationStarted}
          onClose={() => setViewingPositions(null)}
        />
      )}
    </div>
  );
}
