import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { CommissionOrigin, CommissionParty } from "@/types/dashboard";

export type FlowKind = "cash_in" | "cash_out" | "receivable" | "payable";

export interface BreakdownEntry {
  amount: string;
  origin?: CommissionOrigin;
  /** Direction this entry contributes to the card total — drives labels/colors, not just the amount. */
  flowKind: FlowKind;
  /** When this leg happened (settled) or is expected to happen (pending open position). */
  date?: string;
}

/** One leg (in or out) of an installment's cash flow — either a real movement or a projected open position. */
interface Leg {
  amount: string;
  pending: boolean;
  date?: string;
}

interface InstallmentRow {
  number: number;
  originalValue: string;
  brokerCommissionPercent: number;
  outflowReason?: "repasse" | "multa";
  entrada?: Leg;
  saida?: Leg;
}

interface ProposalGroup {
  proposalNumber: number;
  broker: CommissionParty;
  client: CommissionParty;
  effectiveDate: string;
  lives: number;
  totalValue: string;
  installments: InstallmentRow[];
}

interface PlanGroup {
  planDescription: string;
  proposals: ProposalGroup[];
}

interface OperatorGroup {
  operatorName: string;
  plans: PlanGroup[];
}

function groupByOperator(entries: BreakdownEntry[]): OperatorGroup[] {
  interface ProposalAccum {
    proposalNumber: number;
    broker: CommissionParty;
    client: CommissionParty;
    effectiveDate: string;
    lives: number;
    totalValue: string;
    installments: Map<number, InstallmentRow>;
  }

  const operators = new Map<string, Map<string, Map<number, ProposalAccum>>>();

  for (const entry of entries) {
    if (!entry.origin) continue;
    const {
      operatorName,
      planDescription,
      proposalNumber,
      broker,
      client,
      effectiveDate,
      lives,
      totalValue,
      installmentNumber,
      installments,
      outflowReason,
    } = entry.origin;

    let plans = operators.get(operatorName);
    if (!plans) {
      plans = new Map();
      operators.set(operatorName, plans);
    }
    let proposals = plans.get(planDescription);
    if (!proposals) {
      proposals = new Map();
      plans.set(planDescription, proposals);
    }
    let proposal = proposals.get(proposalNumber);
    if (!proposal) {
      proposal = { proposalNumber, broker, client, effectiveDate, lives, totalValue, installments: new Map() };
      proposals.set(proposalNumber, proposal);
    }
    let installmentRow = proposal.installments.get(installmentNumber);
    if (!installmentRow) {
      const meta = installments.find((i) => i.number === installmentNumber);
      installmentRow = {
        number: installmentNumber,
        originalValue: meta?.originalValue ?? "0.00",
        brokerCommissionPercent: meta?.brokerCommissionPercent ?? 0,
      };
      proposal.installments.set(installmentNumber, installmentRow);
    }
    const leg: Leg = { amount: entry.amount, pending: entry.flowKind === "receivable" || entry.flowKind === "payable", date: entry.date };
    if (entry.flowKind === "cash_in" || entry.flowKind === "receivable") {
      installmentRow.entrada = leg;
    } else {
      installmentRow.saida = leg;
      installmentRow.outflowReason = outflowReason;
    }
  }

  return [...operators.entries()].map(([operatorName, plans]) => ({
    operatorName,
    plans: [...plans.entries()].map(([planDescription, proposals]) => ({
      planDescription,
      proposals: [...proposals.values()].map((p) => ({
        ...p,
        installments: [...p.installments.values()].sort((a, b) => a.number - b.number),
      })),
    })),
  }));
}

const signedAmount = (row: InstallmentRow) => Number(row.entrada?.amount ?? 0) - Number(row.saida?.amount ?? 0);
const sumOf = (rows: InstallmentRow[]) => rows.reduce((sum, row) => sum + signedAmount(row), 0);
const mostRecent = (rows: InstallmentRow[]) => {
  const dates = rows.map((r) => r.entrada?.date ?? r.saida?.date).filter((d): d is string => !!d);
  return dates.reduce((latest, d) => (d > latest ? d : latest), dates[0] ?? "");
};
const toneClasses = { ok: "text-ok", bad: "text-bad" } as const;
const dotClasses = { ok: "bg-ok", bad: "bg-bad" } as const;

/** Picks the subtitle/caption/color for a group of rows based on which legs (entrada/saída) and settlement it mixes. */
function describeGroup(rows: InstallmentRow[], total: number) {
  const entradaRows = rows.filter((r) => r.entrada);
  const saidaRows = rows.filter((r) => r.saida);
  const hasEntrada = entradaRows.length > 0;
  const hasSaida = saidaRows.length > 0;
  // An installment's entrada and saída are never mixed settled/pending against each other in this
  // dataset (an outflow only exists once the commission itself was received), so the first row suffices.
  const pending = hasEntrada ? entradaRows[0].entrada!.pending : hasSaida ? saidaRows[0].saida!.pending : false;
  const tone = total >= 0 ? ("ok" as const) : ("bad" as const);

  if (hasEntrada && hasSaida) {
    return pending
      ? { subtitleKey: "projectedSubtitle" as const, captionKey: "projectedCaption" as const, tone, pending }
      : { subtitleKey: "netSubtitle" as const, captionKey: "netCaption" as const, tone, pending };
  }
  if (hasEntrada) {
    return pending
      ? { subtitleKey: "receivableSubtitle" as const, captionKey: "receivableCaption" as const, tone, pending }
      : { subtitleKey: "receivedSubtitle" as const, captionKey: "receivedCaption" as const, tone, pending };
  }
  return pending
    ? { subtitleKey: "payableSubtitle" as const, captionKey: "payableCaption" as const, tone, pending }
    : { subtitleKey: "repassedSubtitle" as const, captionKey: "repassedCaption" as const, tone, pending };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-90")}>
      <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
      <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PartyReveal({
  id,
  label,
  party,
  activeId,
  setActiveId,
}: {
  id: string;
  label: string;
  party: CommissionParty;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}) {
  const { t } = useLanguage();
  const open = activeId === id;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
  }, [open]);

  return (
    <span data-party-root className="inline-flex items-center gap-1.5 text-[12.5px]">
      <span className="text-muted">{label}:</span>
      <span className="text-ink">{party.name}</span>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t.dashboard.breakdown.viewDetails}
        onClick={() => setActiveId(open ? null : id)}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink dark:hover:bg-white/10",
          open && "bg-ink/8 text-ink dark:bg-white/10",
        )}
      >
        <EyeIcon />
      </button>
      {open &&
        pos &&
        createPortal(
          <Card
            padding="md"
            data-party-root
            className="fixed z-[200] w-64 bg-panel-solid shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <dl className="space-y-2 text-[12.5px]">
              <div>
                <dt className="text-muted">{t.dashboard.breakdown.party.name}</dt>
                <dd className="text-ink">{party.name}</dd>
              </div>
              <div>
                <dt className="text-muted">{t.dashboard.breakdown.party.phone}</dt>
                <dd className="tabular text-ink">{party.cellphoneNumber}</dd>
              </div>
              <div>
                <dt className="text-muted">{t.dashboard.breakdown.party.email}</dt>
                <dd className="text-ink">{party.email}</dd>
              </div>
              <div>
                <dt className="text-muted">{t.dashboard.breakdown.party.document}</dt>
                <dd className="tabular text-ink">{party.cpfOrCnpj}</dd>
              </div>
            </dl>
          </Card>,
          document.body,
        )}
    </span>
  );
}

/** Expandable Operadora > Plano > Proposta > Parcela drill-down for a card's composing commission entries. */
export function CommissionBreakdown({ entries, currency }: { entries: BreakdownEntry[]; currency: string }) {
  const { t } = useLanguage();
  const groups = groupByOperator(entries);
  const [expandedOperators, setExpandedOperators] = useState<Set<string>>(new Set());
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [expandedProposals, setExpandedProposals] = useState<Set<string>>(new Set());
  const [activePartyId, setActivePartyId] = useState<string | null>(null);

  useEffect(() => {
    if (!activePartyId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePartyId(null);
    };
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-party-root]")) setActivePartyId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [activePartyId]);

  if (groups.length === 0) {
    return <p className="px-5 py-4 text-[13px] text-muted">{t.dashboard.breakdown.empty}</p>;
  }

  function toggle(set: Set<string>, setter: (next: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  return (
    <div className="border-b border-line px-5 py-4">
      <h3 className="mb-3 text-[13px] font-semibold text-ink">{t.dashboard.breakdown.title}</h3>
      <div className="space-y-2">
        {groups.map((group) => {
          const operatorOpen = expandedOperators.has(group.operatorName);
          const allRows = group.plans.flatMap((plan) => plan.proposals.flatMap((p) => p.installments));
          const operatorTotal = sumOf(allRows);
          const operatorDesc = describeGroup(allRows, operatorTotal);
          return (
            <div key={group.operatorName} className="overflow-hidden rounded-xl bg-ink/4 dark:bg-white/6">
              <button
                type="button"
                onClick={() => toggle(expandedOperators, setExpandedOperators, group.operatorName)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left"
              >
                <Avatar name={group.operatorName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{group.operatorName}</p>
                  <p className="text-[12px] text-muted">{t.dashboard.breakdown[operatorDesc.subtitleKey]}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[13px] font-semibold text-ink">
                    {operatorDesc.pending ? t.dashboard.breakdown.pendingStatus : t.dashboard.breakdown.consolidated}
                  </p>
                  <p className="text-[12px] text-muted">{t.dashboard.breakdown.statusCaption}</p>
                </div>
                <div className="text-right">
                  <p className={cn("whitespace-nowrap tabular text-[13px] font-semibold", toneClasses[operatorDesc.tone])}>
                    {formatMoney(Math.abs(operatorTotal).toFixed(2), currency)}
                  </p>
                  <p className="text-[12px] text-muted">{t.dashboard.breakdown[operatorDesc.captionKey]}</p>
                </div>
                <ChevronIcon open={operatorOpen} />
              </button>
              {operatorOpen && (
                <div className="divide-y divide-line border-t border-line">
                  {group.plans.map((plan) => {
                    const planKey = `${group.operatorName}::${plan.planDescription}`;
                    const planOpen = expandedPlans.has(planKey);
                    const planRows = plan.proposals.flatMap((p) => p.installments);
                    const planTotal = sumOf(planRows);
                    const planDesc = describeGroup(planRows, planTotal);
                    return (
                      <div key={planKey}>
                        <button
                          type="button"
                          onClick={() => toggle(expandedPlans, setExpandedPlans, planKey)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                        >
                          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotClasses[planDesc.tone])} />
                          <span className="flex-1 truncate text-[12.5px] font-medium text-ink">{plan.planDescription}</span>
                          <span className={cn("whitespace-nowrap tabular text-[12.5px] font-semibold", toneClasses[planDesc.tone])}>
                            {formatMoney(Math.abs(planTotal).toFixed(2), currency)}
                          </span>
                          <span className="hidden tabular text-[12px] text-muted sm:inline">{formatDate(mostRecent(planRows))}</span>
                          <ChevronIcon open={planOpen} />
                        </button>
                        {planOpen && (
                          <div className="divide-y divide-line bg-panel-solid">
                            {plan.proposals.map((proposal) => {
                              const proposalKey = `${planKey}::${proposal.proposalNumber}`;
                              const proposalOpen = expandedProposals.has(proposalKey);
                              return (
                                <div key={proposalKey}>
                                  <button
                                    type="button"
                                    onClick={() => toggle(expandedProposals, setExpandedProposals, proposalKey)}
                                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 pl-8 pr-3 text-left"
                                  >
                                    <span className="text-[12.5px] font-semibold text-ink">#{proposal.proposalNumber}</span>
                                    <PartyReveal
                                      id={`client-${proposalKey}`}
                                      label={t.dashboard.breakdown.client}
                                      party={proposal.client}
                                      activeId={activePartyId}
                                      setActiveId={setActivePartyId}
                                    />
                                    <PartyReveal
                                      id={`broker-${proposalKey}`}
                                      label={t.dashboard.breakdown.broker}
                                      party={proposal.broker}
                                      activeId={activePartyId}
                                      setActiveId={setActivePartyId}
                                    />
                                    <span className="text-[12px] text-muted">{proposal.lives} {t.dashboard.breakdown.lives.toLowerCase()}</span>
                                    <span className="tabular text-[12px] text-muted">{formatDate(proposal.effectiveDate)}</span>
                                    <span className="ml-auto flex items-center gap-4">
                                      <span className="text-right">
                                        <span className="block tabular text-[12.5px] font-semibold text-ink">
                                          {formatMoney(proposal.totalValue, currency)}
                                        </span>
                                        <span className="block text-[11px] text-muted">{t.dashboard.breakdown.proposalValue}</span>
                                      </span>
                                      <ChevronIcon open={proposalOpen} />
                                    </span>
                                  </button>
                                  {proposalOpen && (
                                    <div className="overflow-x-auto bg-ink/[0.03] pl-5 dark:bg-white/[0.04]">
                                      <table className="w-full text-[12.5px]">
                                        <thead>
                                          <tr className="border-b border-line">
                                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted">
                                              {t.dashboard.breakdown.installmentNumber}
                                            </th>
                                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted">
                                              {t.dashboard.breakdown.date}
                                            </th>
                                            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted">
                                              {t.dashboard.breakdown.originalValue}
                                            </th>
                                            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted">
                                              {t.dashboard.breakdown.commissionPercent}
                                            </th>
                                            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted">
                                              {t.dashboard.table.cashInColumn}
                                            </th>
                                            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted">
                                              {t.dashboard.table.cashOutColumn}
                                            </th>
                                            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted">
                                              {t.dashboard.breakdown.netCaption}
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {proposal.installments.map((inst) => {
                                            const net = signedAmount(inst);
                                            const date = inst.entrada?.date ?? inst.saida?.date;
                                            const isMulta = inst.outflowReason === "multa";
                                            return (
                                              <tr key={inst.number} className="border-b border-line last:border-0">
                                                <td className="px-3 py-2 tabular text-ink">
                                                  {inst.number}/{proposal.installments.length}
                                                </td>
                                                <td className="px-3 py-2 tabular text-muted">{date ? formatDate(date) : "—"}</td>
                                                <td className="px-3 py-2 text-right tabular text-muted">
                                                  {formatMoney(inst.originalValue, currency)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular text-muted">
                                                  {inst.outflowReason === "repasse" ? `${inst.brokerCommissionPercent}%` : "—"}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular font-semibold text-ok">
                                                  {inst.entrada ? formatMoney(inst.entrada.amount, currency) : "—"}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <p className="tabular font-semibold text-bad">
                                                    {inst.saida ? formatMoney(inst.saida.amount, currency) : "—"}
                                                  </p>
                                                  {inst.outflowReason && (
                                                    <p className="text-[11px] text-muted">
                                                      {isMulta ? t.dashboard.breakdown.multaLabel : t.dashboard.breakdown.repasseLabel}
                                                    </p>
                                                  )}
                                                </td>
                                                <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular font-semibold", toneClasses[net >= 0 ? "ok" : "bad"])}>
                                                  {formatMoney(Math.abs(net).toFixed(2), currency)}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
