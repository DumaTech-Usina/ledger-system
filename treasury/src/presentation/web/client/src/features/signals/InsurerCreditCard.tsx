import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { translateMessage } from "@/features/operations/copy";
import { partiesApi, type PartyName } from "@/features/parties/partiesApi";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatMoneyForLanguage } from "@/utils/format";
import { amountDigits, amountFromDigits, maskedAmount } from "@/utils/money";
import { byProposal, creditCopy, healthCreditCopy, labelFromPositionId, receivableLabel } from "./creditCopy";
import { allOf, creditAllocations, creditTotals, visibleLines } from "./creditForm";
import { signalsApi, type CreditResult, type InsurerReceivable } from "./signalsApi";
import { cashApi, type Institution } from "@/features/cash/cashApi";

/** The value of "não informada"; the API receives it as null (REQ-674). */
const NOT_STATED = "__none__";

const STEP_VARIANT: Record<string, "ok" | "bad" | "warn" | "neutral"> = {
  accepted: "ok",
  rejected: "bad",
  awaiting_correction: "warn",
  not_sent: "neutral",
};

/** Past this many open lines, the list offers a filter: an operator can owe many installments. */
const FILTER_FROM = 8;
/**
 * At most this many lines are drawn at once: in a peak fortnight an operator can owe hundreds of
 * installments (2026-11-17). The filter finds the others; a line already given an amount is always drawn.
 */
const SHOW_AT_MOST = 100;

/**
 * §4.6 block D (REQ-277): one bank credit from the insurer, spread over its open expected
 * commissions. The leftover is recorded as received with no origin, never guessed.
 *
 * §4.7 (REQ-292): the same card for a health operator, whose credit covers installments of one or
 * several proposals. Same receipts, same batch; only the labels change.
 */
export function InsurerCreditCard({
  onRecorded,
  system = "insurance",
  fixedPayer,
}: {
  onRecorded: () => void;
  system?: "insurance" | "health";
  /** REQ-695: the payer already chosen where the card is shown (the receivables agenda); not asked again. */
  fixedPayer?: { partyId: string; displayName: string };
}) {
  const { language } = useLanguage();
  const copy = (system === "health" ? healthCreditCopy : creditCopy)[language];
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [parties, setParties] = useState<PartyName[]>([]);
  const [payer, setPayer] = useState(fixedPayer?.partyId ?? "");
  const [creditDigits, setCreditDigits] = useState("");
  const [date, setDate] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institution, setInstitution] = useState("");
  const [receivables, setReceivables] = useState<InsurerReceivable[] | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreditResult | null>(null);
  const money = (amount: string | null) => (amount === null ? copy.unknown : formatMoneyForLanguage(amount, "BRL", language));

  useEffect(() => {
    if (!open || parties.length > 0) return;
    void partiesApi.names().then(({ ok, data }) => ok && setParties(data.parties));
    void cashApi.list().then(({ ok, data }) => ok && "institutions" in data && setInstitutions(data.institutions));
  }, [open, parties.length]);

  useEffect(() => {
    setReceivables(null);
    setAllocations({});
    if (!payer) return;
    void signalsApi.receivables(payer).then(({ ok, data }) => {
      if (ok && "receivables" in data) setReceivables(byProposal(data.receivables));
      else setError(copy.genericError);
    });
  }, [payer, copy.genericError]);

  const totals = creditTotals({ creditDigits, allocations });
  const needle = filter.trim().toLowerCase();
  // A line already given an amount stays visible whatever the filter: it is part of the credit.
  const { shown, matching } = visibleLines(receivables ?? [], allocations, needle, (r) => receivableLabel(r, language), SHOW_AT_MOST);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setResult(null);
    const { ok, data } = await signalsApi.registerCredit({
      payer,
      creditAmount: amountFromDigits(creditDigits),
      occurredAt: date,
      allocations: creditAllocations({ creditDigits, allocations }),
      institution: institution === NOT_STATED ? null : institution,
    });
    setSaving(false);
    if (ok && "steps" in data) {
      setResult(data);
      setCreditDigits("");
      setAllocations({});
      onRecorded();
      const fresh = await signalsApi.receivables(payer);
      if (fresh.ok && "receivables" in fresh.data) setReceivables(byProposal(fresh.data.receivables));
      return;
    }
    setError("error" in data ? translateMessage(data.error) : copy.genericError);
  };

  return (
    // Above the register card that follows (z-10): each glass card isolates its own layers, so a lower
    // z here opened the date picker and the selects underneath it. Below the sticky topbar (z-30).
    <Card className="z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h3 className="font-display text-lg font-semibold text-ink">{fixedPayer ? copy.titleFor(fixedPayer.displayName) : copy.title}</h3>
        <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform", open && "rotate-180")} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <p className="mt-2 text-xs text-muted">{fixedPayer ? copy.noteForPayer : copy.note}</p>
          <div className={cn("mt-4 grid gap-4 md:grid-cols-2", fixedPayer ? "xl:grid-cols-3" : "xl:grid-cols-4")}>
            {!fixedPayer && (
              <Select
                label={copy.insurer}
                value={payer}
                onChange={setPayer}
                searchPlaceholder={copy.chooseInsurer}
                options={[{ value: "", label: copy.chooseInsurer }, ...parties.map((p) => ({ value: p.partyId, label: p.displayName }))]}
              />
            )}
            <Input
              label={copy.amount}
              inputMode="numeric"
              value={creditDigits === "" ? "" : maskedAmount(creditDigits)}
              disabled={saving}
              onChange={(e) => setCreditDigits(amountDigits(e.target.value))}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-muted">{copy.date}</span>
              <DatePicker value={date} onChange={setDate} disabled={saving} />
            </div>
            <Select
              label={copy.institution}
              value={institution}
              onChange={setInstitution}
              options={[
                { value: "", label: copy.chooseInstitution },
                ...institutions.map((i) => ({ value: i.key, label: i.name })),
                { value: NOT_STATED, label: copy.notStated },
              ]}
            />
          </div>

          {payer && receivables !== null && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink">
                {fixedPayer ? copy.receivablesTitleFor(fixedPayer.displayName) : copy.receivablesTitle}
              </p>
              {receivables.length === 0 && (
                <p className="mt-1 text-xs text-muted">{fixedPayer ? copy.noneFor(fixedPayer.displayName) : copy.none}</p>
              )}
              {receivables.length > FILTER_FROM && (
                <div className="mt-2 max-w-sm">
                  <Input label={copy.filter} value={filter} onChange={(e) => setFilter(e.target.value)} />
                </div>
              )}
              {matching > shown.length && <p className="mt-2 text-xs text-muted">{copy.showing(shown.length, matching)}</p>}
              <ul className="mt-2 space-y-2">
                {shown.map((r) => {
                  const digits = allocations[r.objectId] ?? "";
                  return (
                    <li key={r.objectId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-3 py-2">
                      <span className="min-w-0 basis-full text-[13px] text-ink sm:basis-auto sm:flex-1">
                        {r.installment || r.policyId ? (
                          <span className="font-medium">{receivableLabel(r, language)}</span>
                        ) : (
                          <span className="font-mono text-muted">{r.objectId}</span>
                        )}
                        <span className="ml-2 text-muted">
                          · {copy.open} {money(r.openBalance)}
                        </span>
                      </span>
                      <div className="w-40">
                        <Input
                          aria-label={`${copy.receive} ${receivableLabel(r, language)}`}
                          inputMode="numeric"
                          value={digits === "" ? "" : maskedAmount(digits)}
                          disabled={saving}
                          onChange={(e) => setAllocations((a) => ({ ...a, [r.objectId]: amountDigits(e.target.value) }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving || r.openBalance === null}
                        onClick={() => setAllocations((a) => ({ ...a, [r.objectId]: allOf(r.openBalance) }))}
                      >
                        {copy.all}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted">
                  {copy.distributed}: <span className="tabular font-semibold text-ink">{money(totals.distributed)}</span>
                </span>
                <span className="text-muted">
                  {copy.unattributed}: <span className="tabular font-semibold text-ink">{money(totals.unattributed)}</span>
                </span>
              </div>
              {totals.over && <p className="mt-1 text-sm font-medium text-bad">{copy.over}</p>}
            </div>
          )}

          {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
          <div className="mt-4">
            <Button loading={saving} disabled={!payer || creditDigits === "" || !date || !institution || totals.over} onClick={submit}>
              {copy.submit}
            </Button>
          </div>

          {result && (
            <div className="mt-4 rounded-2xl bg-ink/[0.03] p-3 dark:bg-white/5">
              <p className="text-sm font-semibold text-ok">{copy.done}</p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {result.steps.map((step, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <span className="text-ink">{step.objectId ? labelFromPositionId(step.objectId, language) : copy.stepUnattributed}</span>
                    <span className="tabular text-muted">{money(step.amount)}</span>
                    <Badge variant={STEP_VARIANT[step.status] ?? "neutral"}>{copy.steps[step.status] ?? step.status}</Badge>
                  </li>
                ))}
              </ul>
              {result.steps.some((s) => s.status === "not_sent") && <p className="mt-2 text-xs text-warn">{copy.stopped}</p>}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
