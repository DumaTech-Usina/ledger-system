import { useEffect, useState } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { morningApi, type Columns, type MorningPanel as Panel } from "@/features/morning/morningApi";
import { morningCopy } from "@/features/morning/morningCopy";
import { brlOf, cell, columnKeys, dayLabel } from "@/features/morning/morningView";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoneyForLanguage } from "@/utils/format";

type Loaded = Extract<Panel, { available: true }>;

/**
 * §8.10 (E7): the morning question — does the known cash cover what falls due? — answered by putting the
 * Ledger's figures side by side, for today. Nothing is summed, netted or concluded here (REQ-684): the
 * expected never joins the cash, and an institution with no opening is named as left out of the total.
 */
export function MorningPanel({ onNavigate }: { onNavigate?: (section: "cash" | "agenda" | "receivables") => void }) {
  const { language } = useLanguage();
  const copy = morningCopy[language];
  const [panel, setPanel] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const day = (ymd: string) => formatDate(`${ymd}T12:00:00`);

  useEffect(() => {
    let alive = true;
    morningApi
      .get()
      .then(({ ok, data }) => {
        if (!alive) return;
        if (ok && data.available) {
          setPanel(data);
          setState("ready");
        } else setState("unavailable");
      })
      .catch(() => alive && setState("unavailable"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "unavailable") return <Banner variant="bad">{copy.unavailable}</Banner>;
  if (!panel) return null;

  const { cash } = panel;
  const keys = columnKeys(panel.payables);
  const header = (key: string) => (key === "overdue" ? copy.overdue : key === panel.asOf ? copy.today : dayLabel(key, language));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold text-ink">{copy.title}</h3>
          <p className="mt-1 max-w-3xl text-[13px] text-muted">{copy.note(day(panel.asOf))}</p>
        </div>
        {onNavigate && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => onNavigate("cash")}>
              {copy.openCash}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("agenda")}>
              {copy.openPayables}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("receivables")}>
              {copy.openReceivables}
            </Button>
          </div>
        )}
      </div>

      {/* The known cash (REQ-681): the Ledger's total, each institution, and what is left out. */}
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,16rem)_1fr]">
        <div className="rounded-2xl border border-line px-4 py-3">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{copy.knownCash}</span>
          {cash.known.institutions.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{copy.noKnown}</p>
          ) : (
            <p className={cn("tabular mt-1 font-display text-2xl font-semibold", cash.known.total.startsWith("-") ? "text-bad" : "text-ink")}>
              {money(cash.known.total)}
            </p>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <ul className="flex flex-wrap gap-2">
            {cash.institutions.map((i) => (
              <li key={i.key} className="rounded-xl bg-ink/[0.04] px-3 py-1.5 text-[13px] dark:bg-white/5">
                <span className="text-muted">{i.name}: </span>
                <span className={cn("font-semibold", i.balance === null ? "text-muted" : cn("tabular", i.balance.startsWith("-") ? "text-bad" : "text-ink"))}>
                  {i.balance === null ? copy.unknownBalance : money(i.balance)}
                </span>
              </li>
            ))}
          </ul>
          {cash.missingOpening.length > 0 && <p className="text-[12.5px] text-warn">{copy.leftOut(cash.missingOpening)}</p>}
          {cash.unknown.count > 0 && (
            <p className="text-[12.5px] text-muted">
              {copy.noInstitution(cash.unknown.since ? day(cash.unknown.since) : null, money(cash.unknown.cashIn), money(cash.unknown.cashOut), cash.unknown.count)}
            </p>
          )}
        </div>
      </div>

      {/* What falls due and what is expected (REQ-682, REQ-683), column by column, never added together. */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="py-2 pr-3 text-left font-semibold text-muted" />
              {keys.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className={cn("whitespace-nowrap px-2 py-2 text-right font-semibold", key === "overdue" ? "text-bad" : key === panel.asOf ? "text-ink" : "text-muted")}
                >
                  {header(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label={copy.payables} columns={panel.payables} keys={keys} tone="bad" />
            <Row label={copy.receivables} columns={panel.receivables} keys={keys} tone="muted" />
          </tbody>
        </table>
      </div>
      {/* Outside any day, so outside the columns: after the window, and with no date at all (REQ-682). */}
      <div className="mt-3 space-y-1 text-[12.5px] text-muted">
        <Beyond label={copy.payables} columns={panel.payables} />
        <Beyond label={copy.receivables} columns={panel.receivables} />
        <p>{copy.receivablesNote}</p>
      </div>
    </Card>
  );
}

/** What falls beyond the columns: later than the window, and undated. */
function Beyond({ label, columns }: { label: string; columns: Columns }) {
  const { language } = useLanguage();
  const copy = morningCopy[language];
  const show = (amount: string | null) => (amount === null ? copy.nothing : formatMoneyForLanguage(amount, "BRL", language));
  return (
    <p>
      <span className="font-semibold text-ink">{label}</span> · {copy.later}: <span className="tabular">{show(brlOf(columns.later))}</span>
      {" · "}
      {copy.undated}: <span className="tabular">{show(brlOf(columns.undated))}</span>
    </p>
  );
}

function Row({ label, columns, keys, tone }: { label: string; columns: Columns; keys: string[]; tone: "bad" | "muted" }) {
  const { language } = useLanguage();
  const copy = morningCopy[language];
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const show = (amount: string | null) => (amount === null ? copy.nothing : money(amount));
  return (
    <tr className="border-t border-line">
      <th scope="row" className="whitespace-nowrap py-2 pr-3 text-left align-top font-semibold text-ink">
        {label}
      </th>
      {keys.map((key) => {
        const amount = brlOf(cell(columns, key));
        return (
          <td
            key={key}
            className={cn(
              "tabular whitespace-nowrap px-2 py-2 text-right align-top",
              amount === null ? "text-muted" : key === "overdue" && tone === "bad" ? "font-semibold text-bad" : "text-ink",
            )}
          >
            {show(amount)}
          </td>
        );
      })}
    </tr>
  );
}
