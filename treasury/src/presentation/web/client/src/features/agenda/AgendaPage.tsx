import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { agendaApi, AGENDA_WINDOWS, type AgendaLine, type AgendaResult, type AgendaWindow } from "@/features/agenda/agendaApi";
import { agendaCopy, windowLabel } from "@/features/agenda/agendaCopy";
import { firstWindow, totalsOf } from "@/features/agenda/agendaEngine";
import { BatchesPanel } from "@/features/batches/BatchesPanel";
import { batchesApi, type BatchesView } from "@/features/batches/batchesApi";
import { batchesCopy } from "@/features/batches/batchesCopy";
import { selectionTotal, toggle, unbatchable, type Selection } from "@/features/batches/batchSelection";
import { PrepareBatchModal } from "@/features/batches/PrepareBatchModal";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils/format";

const PAGE_SIZE = 20;

type Loaded = Extract<AgendaResult, { available: true }>;

/**
 * The agenda of what the Usina owes (§8.5): five windows by due date, each with the Ledger's total, and
 * the lines of the chosen one. A line opens the position, from where the payment starts already linked
 * to it (REQ-603, REQ-644). Nothing here adds Ledger balances up (REQ-642).
 *
 * §8.6: whoever may pay also ticks lines, across windows and pages, and prepares a batch of them; the
 * prepared batches wait above the windows for the bank, and are recorded as paid from there.
 */
export function AgendaPage({
  canPay,
  onOperationStarted,
}: {
  /** Starting a payment writes to the Ledger: gated on `intent:submit`, like every write. */
  canPay: boolean;
  onOperationStarted: (intent: AdoptedIntent) => void;
}) {
  const { t, language } = useLanguage();
  const copy = agendaCopy[language];
  const bcopy = batchesCopy[language];
  const [active, setActive] = useState<AgendaWindow | null>(null);
  const [page, setPage] = useState(1);
  const [agenda, setAgenda] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "failed">("loading");
  const [open, setOpen] = useState<AgendaLine | null>(null);
  const [batches, setBatches] = useState<BatchesView | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [labels, setLabels] = useState<Record<string, { creditor: string; what: string }>>({});
  const [preparing, setPreparing] = useState(false);

  const load = useCallback(async (w: AgendaWindow | null, p: number) => {
    try {
      const { ok, data } = await agendaApi.get({ window: w ?? undefined, page: p, limit: PAGE_SIZE });
      if (!ok) return setState("failed");
      if (!data.available) return setState("unavailable");
      // First visit: open on the most urgent window that has something. Choosing it reads its lines
      // (the effect below), unless the Ledger's default window is already that one.
      if (w === null) {
        const first = firstWindow(data.windows);
        setActive(first);
        if (first !== data.window) return;
      }
      setAgenda(data);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  const loadBatches = useCallback(async () => {
    try {
      const { ok, data } = await batchesApi.list();
      if (ok && "standing" in data) setBatches(data);
    } catch {
      // The agenda stands on its own; the batches panel simply does not show.
    }
  }, []);

  useEffect(() => {
    void load(active, page);
    // `active` and `page` drive the reads; `load` is stable.
  }, [active, page, load]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  /** Obligations already in a standing batch (REJ-239): not offered again. */
  const inBatch = useMemo(() => new Set((batches?.standing ?? []).flatMap((b) => b.lines.map((l) => l.objectId))), [batches]);

  const choose = (w: AgendaWindow) => {
    setPage(1);
    setActive(w);
  };

  const creditorOf = (line: AgendaLine) =>
    line.creditors.length === 0 ? copy.unknownCreditor : line.creditors.map((c) => c.displayName).join(", ");

  const tick = (line: AgendaLine) => {
    setSelection((s) => toggle(s, line));
    setLabels((l) => ({ ...l, [line.objectId]: { creditor: creditorOf(line), what: t.objectType[line.objectType] ?? line.objectType } }));
  };

  const refresh = () => {
    void load(active, page);
    void loadBatches();
  };

  const money = (amount: string, currency: string) => formatMoney(amount, currency);
  const chosen = Object.keys(selection).length;

  return (
    <div className={cn("space-y-6", chosen > 0 && "pb-24")}>
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{copy.heading}</h2>
        {agenda && <p className="mt-1 max-w-3xl text-sm text-muted">{copy.subheading(formatDate(`${agenda.asOf}T12:00:00`))}</p>}
      </div>

      {state === "unavailable" && <Banner variant="bad">{copy.unavailable}</Banner>}
      {state === "failed" && <Banner variant="bad">{copy.loadError}</Banner>}

      {batches && <BatchesPanel view={batches} canPay={canPay} onChanged={refresh} />}

      {agenda && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label={copy.heading}>
            {AGENDA_WINDOWS.map((w) => {
              const summary = agenda.windows[w];
              const totals = totalsOf(summary.totals);
              const selected = active === w;
              const alarming = w === "overdue" && summary.count > 0;
              return (
                <button
                  key={w}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => choose(w)}
                  className={cn(
                    "glass flex min-w-0 flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition",
                    selected ? "border-accent ring-2 ring-accent-soft" : "border-line hover:border-accent/50",
                    w === "undated" && "col-span-2 sm:col-span-1",
                  )}
                >
                  <span className={cn("text-[12.5px] font-semibold uppercase tracking-wide", alarming ? "text-bad" : "text-muted")}>
                    {windowLabel(copy, w, agenda.windowDays)}
                  </span>
                  <span className={cn("tabular truncate font-display text-xl font-semibold", alarming ? "text-bad" : "text-ink")}>
                    {totals.length === 0 ? copy.nothing : totals.map((x) => money(x.amount, x.currency)).join(" · ")}
                  </span>
                  <span className="text-[12.5px] text-muted">{copy.items(summary.count)}</span>
                </button>
              );
            })}
          </div>

          {active && (
            <Card>
              <h3 className="font-display text-lg font-semibold text-ink">{windowLabel(copy, active, agenda.windowDays)}</h3>
              <p className="mt-1 text-[13px] text-muted">{copy.windowHint[active]}</p>

              {agenda.lines.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{copy.empty[active]}</p>
              ) : (
                <Table.Root className="mt-3">
                  <Table.Head>
                    <Table.Row>
                      {canPay && (
                        <Table.HeaderCell className="w-10">
                          <span className="sr-only">{bcopy.select}</span>
                        </Table.HeaderCell>
                      )}
                      <Table.HeaderCell>{copy.creditor}</Table.HeaderCell>
                      <Table.HeaderCell>{copy.what}</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">{copy.open}</Table.HeaderCell>
                      <Table.HeaderCell>{active === "undated" ? copy.openFor : copy.due}</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">
                        <span className="sr-only">{copy.pay}</span>
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {agenda.lines.map((line) => {
                      const why = inBatch.has(line.objectId) ? "inBatch" : unbatchable(line);
                      return (
                        <Table.Row key={line.objectId} className={cn(selection[line.objectId] && "bg-accent-soft/40")}>
                          {canPay && (
                            <Table.Cell>
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--color-accent)] disabled:opacity-40"
                                aria-label={`${bcopy.select}: ${creditorOf(line)}`}
                                title={why ? bcopy.cannot[why] : bcopy.select}
                                disabled={why !== null}
                                checked={!!selection[line.objectId]}
                                onChange={() => tick(line)}
                              />
                            </Table.Cell>
                          )}
                          <Table.Cell>
                            <span className="font-semibold text-ink">{creditorOf(line)}</span>
                          </Table.Cell>
                          <Table.Cell className="text-muted">{t.objectType[line.objectType] ?? line.objectType}</Table.Cell>
                          <Table.Cell mono className="text-right">
                            <span className="font-semibold text-ink">{line.openBalance && money(line.openBalance, line.currency)}</span>
                            {line.partiallyPaid && (
                              <span className="block text-[12px] text-muted">{copy.of(money(line.totalOriginated, line.currency))}</span>
                            )}
                          </Table.Cell>
                          <Table.Cell mono className={cn(active === "overdue" && "font-semibold text-bad")}>
                            {line.dueAt
                              ? formatDate(line.dueAt)
                              : line.openForDays === null
                                ? copy.unknownAge
                                : copy.days(line.openForDays)}
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Button size="sm" variant={canPay ? "primary" : "ghost"} onClick={() => setOpen(line)}>
                              {canPay ? copy.pay : copy.view}
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
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

      {canPay && chosen > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[50] px-4 pb-4">
          <div className="glass mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{bcopy.selected(chosen)}</p>
              <p className="tabular text-[13px] text-muted">{formatMoney(selectionTotal(selection), "BRL")}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelection({})}>
              {bcopy.clear}
            </Button>
            <Button size="sm" onClick={() => setPreparing(true)}>
              {bcopy.prepare}
            </Button>
          </div>
        </div>
      )}

      {preparing && (
        <PrepareBatchModal
          selection={selection}
          labelOf={(id) => labels[id] ?? { creditor: id, what: "" }}
          onChange={setSelection}
          onClose={() => setPreparing(false)}
          onPrepared={() => {
            setPreparing(false);
            setSelection({});
            void loadBatches();
          }}
        />
      )}

      {open && (
        <RowDetailModal
          position={open}
          currency={open.currency}
          partyNames={Object.fromEntries(open.creditors.map((c) => [c.partyId, c.displayName]))}
          canRectify={canPay}
          onOperationStarted={(intent) => {
            setOpen(null);
            onOperationStarted(intent);
          }}
          onClose={() => {
            setOpen(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
