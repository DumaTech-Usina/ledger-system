import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/Badge";
import { CopyableId } from "@/components/CopyableId";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { statusTone } from "@/features/dashboard/lifecycleEngine";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { PositionItem } from "@/types/dashboard";

const PAGE_SIZE = 10;

function EyeIcon() {
  return <Eye className="size-4" strokeWidth={1.4} />;
}


export function PositionsTable({
  positions,
  currency,
  canRectify = false,
  onOperationStarted,
  paginate = true,
  showDueDate = false,
  showParties = false,
  selectedParties = [],
  selfPartyId = "",
  partyNames = {},
}: {
  positions: PositionItem[];
  currency: string;
  canRectify?: boolean;
  /** Hands a conversation opened from a position over to the operations page. */
  onOperationStarted?: (intent: AdoptedIntent) => void;
  /**
   * Off when the caller already asked the Ledger for one page and owns the pager itself. Slicing
   * again here would page a page.
   */
  paginate?: boolean;
  /**
   * Adds the due-date column. Off by default: most positions are not obligations and have no due
   * date, and a column that is empty for nearly every row reads as missing data rather than as a
   * question that does not apply.
   */
  showDueDate?: boolean;
  /**
   * Adds the parties column. Off by default — most listings do not carry `parties` at all, and a
   * column that is empty for every row would read as missing data.
   */
  showParties?: boolean;
  /** Which ids came from a `partyId` filter — highlighted among the row's full cast, never used to hide the rest. */
  selectedParties?: string[];
  /** The usina's own party id — marked among the cast rather than filtered out. */
  selfPartyId?: string;
  /**
   * Display names by party id, as the Directory knows them. An id the Directory cannot name is
   * absent here and stays on screen as the id — never replaced by an invented label.
   */
  partyNames?: Record<string, string>;
}) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PositionItem | null>(null);

  useEffect(() => {
    setPage(1);
  }, [positions]);

  const totalPages = Math.max(1, Math.ceil(positions.length / PAGE_SIZE));
  const pageRows = paginate ? positions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : positions;

  return (
    <div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{t.dashboard.table.type}</Table.HeaderCell>
            {/* When the position entered the book — the key the default listing is ordered by. */}
            <Table.HeaderCell>{t.dashboard.table.date}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.status}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.openBalance}</Table.HeaderCell>
            {showDueDate && <Table.HeaderCell>{t.positions.dueOn}</Table.HeaderCell>}
            {showParties && <Table.HeaderCell>{t.dashboard.table.parties}</Table.HeaderCell>}
            {/* Last: the id identifies the row, it does not describe it. Reading starts from what
                the position IS and ends at the key you carry away from it. */}
            <Table.HeaderCell>{t.dashboard.table.id}</Table.HeaderCell>
            <Table.HeaderCell aria-hidden />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {positions.length === 0 ? (
            <Table.Row>
              <Table.Cell
                colSpan={6 + (showDueDate ? 1 : 0) + (showParties ? 1 : 0)}
                className="text-center text-muted"
              >
                {t.common.noRecords}
              </Table.Cell>
            </Table.Row>
          ) : (
            pageRows.map((p) => (
              <Table.Row key={p.objectId}>
                <Table.Cell className="text-muted">{t.objectType[p.objectType] ?? p.objectType}</Table.Cell>
                {/* `createdAt` is always present — even a cash-basis position with no origination
                    entered the book at some point, which is what this column, unlike `originatedAt`, answers. */}
                <Table.Cell mono className="text-muted">
                  {p.createdAt === null ? t.common.unknown : formatDate(p.createdAt)}
                </Table.Cell>
                {/* A status this app has no name for is said to be unrecognised, not printed raw —
                    but the Ledger's own word stays in the tooltip, because a reader who reports the
                    gap needs to be able to say WHAT the book published. */}
                <Table.Cell>
                  {/* Same tone scale as the lifecycle timeline: a status must not change colour
                      between the list and the history of the very same position. */}
                  <Badge variant={statusTone(p.status)} dot title={p.status}>
                    {t.positionStatus[p.status] ?? t.common.unrecognizedStatus}
                  </Badge>
                </Table.Cell>
                {/* A null balance is an unknown origination, not a zero — the two must never look alike. */}
                <Table.Cell mono className={p.openBalance === null ? "text-muted" : undefined}>
                  {p.openBalance === null ? t.common.unknown : formatMoney(p.openBalance, p.currency || currency)}
                </Table.Cell>
                {/* A missing due date is a fact about the document that originated the obligation,
                    not a blank cell — it says so in words rather than looking like absent data. */}
                {showDueDate && (
                  <Table.Cell className={p.dueAt === null ? "text-muted" : undefined}>
                    {p.dueAt === null ? t.positions.noDueDate : formatDate(p.dueAt)}
                  </Table.Cell>
                )}
                {/* The row's whole cast, not only the counterparty a filter matched: a position
                    originated with one party and settled by another must show both. Selection only
                    highlights; it never trims who is shown. */}
                {showParties && (
                  <Table.Cell>
                    {!p.parties || p.parties.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.parties.map((partyId) => {
                          const matched = selectedParties.includes(partyId);
                          const isSelf = partyId === selfPartyId && selfPartyId !== "";
                          return (
                            <span
                              key={partyId}
                              title={isSelf ? t.dashboard.table.selfParty : undefined}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                matched
                                  ? "bg-accent-soft text-accent dark:text-secondary"
                                  : "bg-ink/6 text-muted dark:bg-white/8"
                              }`}
                            >
                              {isSelf ? t.dashboard.table.selfParty : partyNames[partyId] ?? partyId}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </Table.Cell>
                )}
                <Table.Cell>
                  <CopyableId value={p.objectId} />
                </Table.Cell>
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
      {paginate && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      {selected && (
        <RowDetailModal
          position={selected}
          currency={currency}
          canRectify={canRectify}
          onOperationStarted={onOperationStarted}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
