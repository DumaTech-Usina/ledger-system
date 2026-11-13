import { useCallback, useEffect, useState } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { agendaApi, AGENDA_WINDOWS, type AgendaLine, type AgendaResult, type AgendaWindow } from "@/features/agenda/agendaApi";
import { agendaCopy, windowLabel } from "@/features/agenda/agendaCopy";
import { firstWindow, totalsOf } from "@/features/agenda/agendaEngine";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils/format";

const PAGE_SIZE = 20;

type Loaded = Extract<AgendaResult, { available: true }>;

/**
 * The agenda of what the Usina owes (§8.5): five windows by due date, each with the Ledger's total, and
 * the lines of the chosen one. A line opens the position, from where the payment starts already linked
 * to it (REQ-603, REQ-644). Nothing here adds money up (REQ-642).
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
  const [window, setWindow] = useState<AgendaWindow | null>(null);
  const [page, setPage] = useState(1);
  const [agenda, setAgenda] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "failed">("loading");
  const [open, setOpen] = useState<AgendaLine | null>(null);

  const load = useCallback(async (w: AgendaWindow | null, p: number) => {
    try {
      const { ok, data } = await agendaApi.get({ window: w ?? undefined, page: p, limit: PAGE_SIZE });
      if (!ok) return setState("failed");
      if (!data.available) return setState("unavailable");
      // First visit: open on the most urgent window that has something. Choosing it reads its lines
      // (the effect below), unless the Ledger's default window is already that one.
      if (w === null) {
        const first = firstWindow(data.windows);
        setWindow(first);
        if (first !== data.window) return;
      }
      setAgenda(data);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    void load(window, page);
    // `window` and `page` drive the reads; `load` is stable.
  }, [window, page, load]);

  const choose = (w: AgendaWindow) => {
    setPage(1);
    setWindow(w);
  };

  const money = (amount: string, currency: string) => formatMoney(amount, currency);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{copy.heading}</h2>
        {agenda && <p className="mt-1 max-w-3xl text-sm text-muted">{copy.subheading(formatDate(`${agenda.asOf}T12:00:00`))}</p>}
      </div>

      {state === "unavailable" && <Banner variant="bad">{copy.unavailable}</Banner>}
      {state === "failed" && <Banner variant="bad">{copy.loadError}</Banner>}

      {agenda && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label={copy.heading}>
            {AGENDA_WINDOWS.map((w) => {
              const summary = agenda.windows[w];
              const totals = totalsOf(summary.totals);
              const selected = window === w;
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

          {window && (
            <Card>
              <h3 className="font-display text-lg font-semibold text-ink">{windowLabel(copy, window, agenda.windowDays)}</h3>
              <p className="mt-1 text-[13px] text-muted">{copy.windowHint[window]}</p>

              {agenda.lines.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{copy.empty[window]}</p>
              ) : (
                <Table.Root className="mt-3">
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>{copy.creditor}</Table.HeaderCell>
                      <Table.HeaderCell>{copy.what}</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">{copy.open}</Table.HeaderCell>
                      <Table.HeaderCell>{window === "undated" ? copy.openFor : copy.due}</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">
                        <span className="sr-only">{copy.pay}</span>
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {agenda.lines.map((line) => (
                      <Table.Row key={line.objectId}>
                        <Table.Cell>
                          <span className="font-semibold text-ink">
                            {line.creditors.length === 0
                              ? copy.unknownCreditor
                              : line.creditors.map((c) => c.displayName).join(", ")}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-muted">{t.objectType[line.objectType] ?? line.objectType}</Table.Cell>
                        <Table.Cell mono className="text-right">
                          <span className="font-semibold text-ink">{line.openBalance && money(line.openBalance, line.currency)}</span>
                          {line.partiallyPaid && (
                            <span className="block text-[12px] text-muted">{copy.of(money(line.totalOriginated, line.currency))}</span>
                          )}
                        </Table.Cell>
                        <Table.Cell mono className={cn(window === "overdue" && "font-semibold text-bad")}>
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
            void load(window, page);
          }}
        />
      )}
    </div>
  );
}
