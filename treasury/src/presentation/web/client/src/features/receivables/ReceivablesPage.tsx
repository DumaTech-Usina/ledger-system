import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { AGENDA_WINDOWS } from "@/features/agenda/agendaApi";
import { totalsOf } from "@/features/agenda/agendaEngine";
import {
  receivablesApi,
  type DeclaredResult,
  type ReceivableLine,
  type ReceivablesList,
  type ReceivablesResult,
} from "@/features/receivables/receivablesApi";
import { receivableListLabel, receivablesCopy } from "@/features/receivables/receivablesCopy";
import { declaredOf, firstReceivableWindow, payerLabel } from "@/features/receivables/receivablesEngine";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils/format";

const PAGE_SIZE = 20;
const ALL = "__all__";
const LISTS: ReceivablesList[] = [...AGENDA_WINDOWS, "unlinked"];

type Loaded = Extract<ReceivablesResult, { available: true }>;

/**
 * The agenda of what is owed to the Usina (§8.7): five windows by expected date and the money that came
 * in with no known origin, each with the Ledger's totals, narrowed to one payer when chosen. Apart, what
 * the insurer declared paid and the bank has not shown — a signal, never a receipt (REQ-663). A line
 * opens its position, from where the receipt starts already linked to it (REQ-603, REQ-665).
 */
export function ReceivablesPage({
  canReceive,
  onOperationStarted,
}: {
  /** Recording a receipt writes to the Ledger: gated on `intent:submit`, like every write. */
  canReceive: boolean;
  onOperationStarted: (intent: AdoptedIntent) => void;
}) {
  const { t, language } = useLanguage();
  const copy = receivablesCopy[language];
  const [active, setActive] = useState<ReceivablesList | null>(null);
  const [payer, setPayer] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [agenda, setAgenda] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "failed">("loading");
  const [declared, setDeclared] = useState<DeclaredResult | null>(null);
  const [declaredPage, setDeclaredPage] = useState(1);
  const [open, setOpen] = useState<ReceivableLine | null>(null);

  const load = useCallback(async (w: ReceivablesList | null, p: number, who: string | null) => {
    try {
      const { ok, data } = await receivablesApi.get({ window: w ?? undefined, page: p, limit: PAGE_SIZE, payer: who });
      if (!ok) return setState("failed");
      if (!data.available) return setState("unavailable");
      // First visit, or a new payer: open on the most urgent window that has something.
      if (w === null) {
        const first = firstReceivableWindow(data.windows);
        setActive(first);
        if (first !== data.window) return;
      }
      setAgenda(data);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  const loadDeclared = useCallback(async () => {
    try {
      const { ok, data } = await receivablesApi.declared();
      setDeclared(ok ? data : { available: false });
    } catch {
      setDeclared({ available: false });
    }
  }, []);

  useEffect(() => {
    void load(active, page, payer);
    // `active`, `page` and `payer` drive the reads; `load` is stable.
  }, [active, page, payer, load]);

  useEffect(() => {
    void loadDeclared();
  }, [loadDeclared]);

  const choose = (list: ReceivablesList) => {
    setPage(1);
    setActive(list);
  };

  const choosePayer = (value: string) => {
    setPage(1);
    setDeclaredPage(1);
    setActive(null);
    setPayer(value === ALL ? null : value);
  };

  const declaredLines = useMemo(() => (declared?.available ? declaredOf(declared.lines, payer) : []), [declared, payer]);
  const declaredPages = Math.max(1, Math.ceil(declaredLines.length / PAGE_SIZE));
  const declaredSlice = declaredLines.slice((declaredPage - 1) * PAGE_SIZE, declaredPage * PAGE_SIZE);

  const money = (amount: string, currency: string) => formatMoney(amount, currency);
  const unlinkedView = active === "unlinked";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-ink">{copy.heading}</h2>
          {agenda && <p className="mt-1 max-w-3xl text-sm text-muted">{copy.subheading(formatDate(`${agenda.asOf}T12:00:00`))}</p>}
        </div>
        {agenda && agenda.payers.length > 0 && (
          <Select
            className="w-full sm:w-72"
            label={copy.payer}
            value={payer ?? ALL}
            onChange={choosePayer}
            options={[
              { value: ALL, label: copy.allPayers },
              ...agenda.payers.map((g) => ({ value: g.key, label: copy.payerOption(payerLabel(g.payers, copy.unknownPayer), g.count) })),
            ]}
          />
        )}
      </div>

      {state === "unavailable" && <Banner variant="bad">{copy.unavailable}</Banner>}
      {state === "failed" && <Banner variant="bad">{copy.loadError}</Banner>}

      {agenda && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label={copy.heading}>
            {LISTS.map((list) => {
              const summary = list === "unlinked" ? agenda.unlinked : agenda.windows[list];
              const totals = totalsOf(summary.totals);
              const selected = active === list;
              const alarming = list === "overdue" && summary.count > 0;
              return (
                <button
                  key={list}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => choose(list)}
                  className={cn(
                    "glass flex min-w-0 flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition",
                    selected ? "border-accent ring-2 ring-accent-soft" : "border-line hover:border-accent/50",
                    list === "unlinked" && "border-dashed",
                  )}
                >
                  <span className={cn("text-[12.5px] font-semibold uppercase tracking-wide", alarming ? "text-bad" : "text-muted")}>
                    {receivableListLabel(copy, list, agenda.windowDays)}
                  </span>
                  <span className={cn("tabular truncate font-display text-xl font-semibold", alarming ? "text-bad" : "text-ink")}>
                    {totals.length === 0 ? copy.nothing : totals.map((x) => money(x.amount, x.currency)).join(" · ")}
                  </span>
                  <span className="text-[12.5px] text-muted">
                    {copy.items(summary.count)}
                    {list === "unlinked" && totals.length > 0 && ` · ${copy.unlinkedTotal}`}
                  </span>
                </button>
              );
            })}
          </div>

          {active && (
            <Card>
              <h3 className="font-display text-lg font-semibold text-ink">{receivableListLabel(copy, active, agenda.windowDays)}</h3>
              <p className="mt-1 text-[13px] text-muted">{active === "unlinked" ? copy.unlinkedHint : copy.windowHint[active]}</p>

              {agenda.lines.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{copy.empty[active]}</p>
              ) : (
                <Table.Root className="mt-3">
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>{copy.payer}</Table.HeaderCell>
                      <Table.HeaderCell>{copy.what}</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">{unlinkedView ? copy.received : copy.open}</Table.HeaderCell>
                      <Table.HeaderCell>{unlinkedView ? copy.receivedFor : active === "undated" ? copy.openFor : copy.expected}</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">
                        <span className="sr-only">{copy.receive}</span>
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {agenda.lines.map((line) => (
                      <Table.Row key={line.objectId}>
                        <Table.Cell>
                          <span className={cn("font-semibold", line.payers.length === 0 ? "text-muted" : "text-ink")}>
                            {payerLabel(line.payers, copy.unknownPayer)}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-muted">
                          <span className="block">{t.objectType[line.objectType] ?? line.objectType}</span>
                          {line.declared ? (
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[12px]">{copy.policy(line.declared.policyLabel)}</span>
                              <Badge
                                variant="warn"
                                title={copy.declaredTitle(line.declared.insurer ?? copy.theInsurer, money(line.declared.claimed, line.currency))}
                              >
                                {copy.declaredBadge}
                              </Badge>
                            </span>
                          ) : (
                            line.policyId && <span className="block text-[12px]">{copy.policy(line.policyId)}</span>
                          )}
                        </Table.Cell>
                        <Table.Cell mono className="text-right">
                          {unlinkedView ? (
                            <span className="font-semibold text-ink">{line.totalSettled && money(line.totalSettled, line.currency)}</span>
                          ) : (
                            <>
                              <span className="font-semibold text-ink">{line.openBalance && money(line.openBalance, line.currency)}</span>
                              {line.partiallyReceived && (
                                <span className="block text-[12px] text-muted">{copy.of(money(line.totalOriginated, line.currency))}</span>
                              )}
                            </>
                          )}
                        </Table.Cell>
                        <Table.Cell mono className={cn(active === "overdue" && "font-semibold text-bad")}>
                          {line.dueAt && !unlinkedView
                            ? formatDate(line.dueAt)
                            : line.openForDays === null
                              ? copy.unknownAge
                              : copy.days(line.openForDays)}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <Button size="sm" variant={canReceive && !unlinkedView ? "primary" : "ghost"} onClick={() => setOpen(line)}>
                            {canReceive && !unlinkedView ? copy.receive : copy.view}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}

              {agenda.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination page={page} totalPages={agenda.totalPages} onPageChange={setPage} />
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {declared && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink">{copy.declaredHeading}</h3>
          <p className="mt-1 max-w-3xl text-[13px] text-muted">{copy.declaredNote}</p>
          {!declared.available ? (
            <p className="mt-4 text-sm font-medium text-bad">{copy.declaredUnavailable}</p>
          ) : declaredLines.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{copy.declaredEmpty}</p>
          ) : (
            <>
              <Table.Root className="mt-3">
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>{copy.payer}</Table.HeaderCell>
                    <Table.HeaderCell>{copy.what}</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">{copy.declaredClaim}</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">{copy.received}</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">{copy.missing}</Table.HeaderCell>
                    <Table.HeaderCell>{copy.declaredOn}</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {declaredSlice.map((l) => (
                    <Table.Row key={l.objectId}>
                      <Table.Cell>
                        <span className="font-semibold text-ink">
                          {l.payers.length > 0 ? payerLabel(l.payers, copy.unknownPayer) : l.insurer ?? copy.unknownPayer}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-muted">{copy.policy(l.policyLabel)}</Table.Cell>
                      <Table.Cell mono className="text-right">{money(l.claimed, l.currency)}</Table.Cell>
                      <Table.Cell mono className="text-right">{money(l.received, l.currency)}</Table.Cell>
                      <Table.Cell mono className="text-right font-semibold text-ink">{l.open && money(l.open, l.currency)}</Table.Cell>
                      <Table.Cell mono>{l.eligibleAt ? formatDate(`${l.eligibleAt.slice(0, 10)}T12:00:00`) : copy.unknownAge}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              {declaredPages > 1 && (
                <div className="mt-4">
                  <Pagination page={declaredPage} totalPages={declaredPages} onPageChange={setDeclaredPage} />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {open && (
        <RowDetailModal
          position={open}
          currency={open.currency}
          partyNames={Object.fromEntries(open.payers.map((p) => [p.partyId, p.displayName]))}
          canRectify={canReceive}
          onOperationStarted={(intent) => {
            setOpen(null);
            onOperationStarted(intent);
          }}
          onClose={() => {
            setOpen(null);
            void load(active, page, payer);
            void loadDeclared();
          }}
        />
      )}
    </div>
  );
}
