import { useEffect, useState } from "react";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

const PAGE_SIZE = 10;

/** Parses a decimal money string ("1500.00") into integer cents, avoiding float rounding drift. */
function toCents(s: string): bigint {
  const negative = s.trim().startsWith("-");
  const [intPart, decPart = ""] = s.trim().replace(/^[+-]/, "").split(".");
  const cents = BigInt(intPart || "0") * 100n + BigInt((decPart + "00").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export interface MovementsTableProps {
  movements: CashMovement[];
  currency: string;
  /** When passed (even null), renders the Saldo column plus a leading "saldo anterior" row. */
  openingBalance?: string | null;
}

export function MovementsTable({ movements, currency, openingBalance }: MovementsTableProps) {
  const { t } = useLanguage();
  const showBalance = openingBalance !== undefined;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CashMovement | null>(null);

  useEffect(() => {
    setPage(1);
  }, [movements]);

  const ordered = showBalance ? [...movements].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)) : movements;

  let running = showBalance ? toCents(openingBalance ?? "0.00") : 0n;
  const rows = ordered.map((m) => {
    if (showBalance) {
      const delta = m.effect === "cash_in" ? toCents(m.amount) : m.effect === "cash_out" ? -toCents(m.amount) : 0n;
      running += delta;
    }
    return { movement: m, balance: running };
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const colSpan = showBalance ? 7 : 6;

  return (
    <div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{t.dashboard.table.date}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.description}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.document}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.cashInColumn}</Table.HeaderCell>
            <Table.HeaderCell>{t.dashboard.table.cashOutColumn}</Table.HeaderCell>
            {showBalance && <Table.HeaderCell>{t.dashboard.table.balance}</Table.HeaderCell>}
            <Table.HeaderCell aria-hidden />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {movements.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={colSpan} className="text-center text-muted">
                {t.common.noRecords}
              </Table.Cell>
            </Table.Row>
          ) : (
            <>
              {showBalance && page === 1 && (
                <Table.Row>
                  <Table.Cell mono className="text-muted">
                    —
                  </Table.Cell>
                  <Table.Cell className="text-muted">{t.dashboard.table.openingBalance}</Table.Cell>
                  <Table.Cell className="text-muted">—</Table.Cell>
                  <Table.Cell className="text-muted">—</Table.Cell>
                  <Table.Cell className="text-muted">—</Table.Cell>
                  <Table.Cell mono className="font-semibold text-ink">
                    {formatMoney(openingBalance ?? "0.00", currency)}
                  </Table.Cell>
                  <Table.Cell aria-hidden />
                </Table.Row>
              )}
              {pageRows.map(({ movement: m, balance }) => (
                <Table.Row key={m.eventId}>
                  <Table.Cell mono className="text-muted">
                    {formatDate(m.occurredAt)}
                  </Table.Cell>
                  <Table.Cell>
                    <p>{m.description ?? m.counterparty ?? "—"}</p>
                    {m.origin && (
                      <p className="text-[11px] text-muted">
                        {formatTemplate(t.dashboard.table.proposalInstallment, {
                          proposal: m.origin.proposalNumber,
                          installment: m.origin.installmentNumber,
                          total: m.origin.installments.length,
                        })}
                      </p>
                    )}
                  </Table.Cell>
                  <Table.Cell mono className="text-muted">
                    {m.sourceReference}
                  </Table.Cell>
                  <Table.Cell mono className={m.effect === "cash_in" ? "text-ok" : "text-muted"}>
                    {m.effect === "cash_in" ? formatMoney(m.amount, currency) : "—"}
                  </Table.Cell>
                  <Table.Cell mono className={m.effect === "cash_out" ? "text-bad" : "text-muted"}>
                    {m.effect === "cash_out" ? formatMoney(m.amount, currency) : "—"}
                  </Table.Cell>
                  {showBalance && (
                    <Table.Cell mono className="font-semibold text-ink">
                      {formatMoney(fromCents(balance), currency)}
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    <button
                      type="button"
                      aria-label={t.common.viewDetails}
                      title={t.common.viewDetails}
                      onClick={() => setSelected(m)}
                      className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink dark:hover:bg-white/10"
                    >
                      <EyeIcon />
                    </button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </>
          )}
        </Table.Body>
      </Table.Root>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {selected && <RowDetailModal movement={selected} currency={currency} onClose={() => setSelected(null)} />}
    </div>
  );
}
