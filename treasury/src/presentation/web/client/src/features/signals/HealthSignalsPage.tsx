import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/Input";
import { translateMessage } from "@/features/operations/copy";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useLanguage } from "@/i18n/i18n";
import { formatDateTime, formatMoneyForLanguage } from "@/utils/format";
import { maskedAmount } from "@/utils/money";
import { SCENARIO_OF, SIGNAL_FORM, canDismiss, isOpenProposal, missingRequired, signalPayload } from "./signalForm";
import { signalsApi, type SignalFilter, type SignalProposal, type SignalView } from "./signalsApi";
import { signalsCopy } from "./signalsCopy";
import { healthCopy } from "./healthCopy";
import { InsurerCreditCard } from "./InsurerCreditCard";

const STATUS_VARIANT: Record<string, "neutral" | "accent" | "ok" | "bad" | "warn"> = {
  gathering: "warn",
  awaiting_confirmation: "accent",
  awaiting_correction: "warn",
  accepted: "ok",
  rejected: "bad",
  dismissed: "neutral",
};

/**
 * A money field's digits, keeping an explicit zero: on this screen "0,00" says something — the health
 * system sent zero for the broker or the supervisor, which hints there is no obligation (REQ-286).
 */
const digitsKeepingZero = (typed: string): string => {
  const digits = typed.replace(/\D/g, "");
  return digits === "" ? "" : digits.replace(/^0+/, "") || "0";
};

/**
 * §4.7: the health system's own page (REQ-281). The user copies an installment the health system
 * discharged; each fact it reports becomes a proposal reviewed and sent in the ordinary conversation,
 * and an obligation can be declared non-existent (REQ-286). Nothing here sends anything to the Ledger.
 */
export function HealthSignalsPage({
  canCreate,
  canSubmit = false,
  onReview,
  onChanged,
}: {
  canCreate: boolean;
  /** Declaring "não há obrigação" settles a proposal like a submit, so it needs the same permission. */
  canSubmit?: boolean;
  onReview: (intent: AdoptedIntent) => void;
  /** Something changed the number of proposals waiting (the menu badge). */
  onChanged?: () => void;
}) {
  const { language } = useLanguage();
  const copy = healthCopy[language];
  const [signals, setSignals] = useState<SignalView[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<SignalFilter>("needs_action");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const mine = ++requestId.current;
    const { ok, data } = await signalsApi.list({ filter, system: "health" });
    if (mine !== requestId.current) return;
    if (ok && "signals" in data) {
      setSignals(data.signals);
      setNextCursor(data.nextCursor);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  }, [filter]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const mine = requestId.current;
    setLoadingMore(true);
    const { ok, data } = await signalsApi.list({ filter, before: nextCursor, system: "health" });
    setLoadingMore(false);
    if (mine !== requestId.current) return;
    if (ok && "signals" in data) {
      const page = data;
      setSignals((current) => {
        const seen = new Set((current ?? []).map((s) => s.id));
        return [...(current ?? []), ...page.signals.filter((s) => !seen.has(s.id))];
      });
      setNextCursor(page.nextCursor);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const changed = () => {
    void load();
    onChanged?.();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{copy.heading}</h2>
        <p className="mt-1 text-sm text-muted">{copy.subheading}</p>
      </div>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{copy.listTitle}</h3>
        <p className="mt-1 text-xs text-muted">{copy.notAFact}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={copy.listTitle}>
          {(["needs_action", "all"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => {
                if (option === filter) return;
                setSignals(null);
                setNextCursor(null);
                setFilter(option);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-semibold transition",
                filter === option ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-ink",
              )}
            >
              {copy.filters[option]}
            </button>
          ))}
        </div>
        {loadError && <p className="mt-3 text-sm font-medium text-bad">{copy.loadError}</p>}
        {signals !== null && signals.length === 0 && (
          <p className="mt-3 text-sm text-muted">{filter === "needs_action" ? copy.listEmptyNeedsAction : copy.listEmpty}</p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {(signals ?? []).map((signal) => (
            <InstallmentItem
              key={signal.id}
              signal={signal}
              canReview={canCreate}
              canDecide={canSubmit}
              onReview={onReview}
              onDecided={changed}
            />
          ))}
        </ul>
        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
              {copy.loadMore}
            </Button>
          </div>
        )}
      </Card>

      {/* REQ-292: a credit from the operator, spread over installments of one or several proposals. */}
      {canSubmit && <InsurerCreditCard system="health" onRecorded={changed} />}

      {canCreate && <RegisterInstallment onRegistered={changed} startOpen={signals !== null && signals.length === 0} />}
    </div>
  );
}

function RegisterInstallment({ onRegistered, startOpen }: { onRegistered: () => void; startOpen: boolean }) {
  const { language } = useLanguage();
  const copy = healthCopy[language];
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? startOpen;
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDone(false);
  };

  const register = async () => {
    const missing = missingRequired("installment", values);
    if (missing.length > 0) {
      setError(copy.missing(missing.map((key) => copy.fields[key]).join(", ")));
      return;
    }
    setSaving(true);
    setError(null);
    const { ok, data } = await signalsApi.register("installment", signalPayload("installment", values));
    setSaving(false);
    if (ok) {
      setValues({});
      setDone(true);
      onRegistered();
      return;
    }
    setError("error" in data ? translateMessage(data.error) : copy.genericError);
  };

  return (
    // Lifted above the list so the date picker's panel opens over the card that follows.
    <Card className="z-10">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h3 className="font-display text-lg font-semibold text-ink">{copy.registerTitle}</h3>
        <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform", expanded && "rotate-180")} strokeWidth={1.5} />
      </button>
      {done && !expanded && <p className="mt-2 text-sm font-medium text-ok">{copy.registered}</p>}
      {expanded && (
        <>
          <div className="mt-3 flex max-w-2xl flex-col gap-1">
            <p className="text-xs text-muted">{copy.registerNote}</p>
            <p className="text-xs text-muted">{copy.idNote}</p>
            <p className="text-xs text-muted">{copy.zeroNote}</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {SIGNAL_FORM.installment.map((field) => {
              const label = `${copy.fields[field.key]}${field.required ? ` · ${copy.required}` : ""}`;
              const value = values[field.key] ?? "";
              if (field.format === "date") {
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-muted">{label}</span>
                    <DatePicker value={value} onChange={(v) => set(field.key, v)} disabled={saving} />
                  </div>
                );
              }
              if (field.format === "money") {
                return (
                  <Input
                    key={field.key}
                    label={label}
                    inputMode="numeric"
                    value={value === "" ? "" : maskedAmount(value)}
                    disabled={saving}
                    onChange={(e) => set(field.key, digitsKeepingZero(e.target.value))}
                  />
                );
              }
              return (
                <Input
                  key={field.key}
                  label={label}
                  inputMode={field.format === "percent" ? "decimal" : field.format === "count" ? "numeric" : undefined}
                  value={value}
                  disabled={saving}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
          {done && <p className="mt-3 text-sm font-medium text-ok">{copy.registered}</p>}
          <div className="mt-4">
            <Button loading={saving} onClick={register}>
              {copy.register}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function InstallmentItem({
  signal,
  canReview,
  canDecide,
  onReview,
  onDecided,
}: {
  signal: SignalView;
  canReview: boolean;
  canDecide: boolean;
  onReview: (intent: AdoptedIntent) => void;
  onDecided: () => void;
}) {
  const { language } = useLanguage();
  const copy = healthCopy[language];
  const f = signal.fields;
  const money = (key: string) => (f[key] ? formatMoneyForLanguage(f[key], "BRL", language) : null);
  const title = copy.title(String(Number(f.installment)), f.proposalNumber);
  const summary = [
    [copy.summary.usinaValue, money("usinaValue")],
    // REQ-285: absent is unknown, never zero.
    [copy.summary.owedValue, money("owedValue") ?? copy.summary.owedUnknown],
    [copy.summary.nominalValue, money("nominalValue")],
    [copy.summary.brokerValue, money("brokerValue")],
    [copy.summary.supervisorValue, money("supervisorValue")],
    [copy.summary.taxRate, f.taxRate ? `${f.taxRate.replace(".", language === "pt-BR" ? "," : ".")}%` : null],
    [copy.summary.operator, f.operator],
  ].filter((pair): pair is [string, string] => Boolean(pair[1]));

  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-muted">{copy.receivedAt(formatDateTime(signal.receivedAt), signal.recordedByName ?? copy.author(signal.recordedBy))}</p>
      </div>
      {summary.length > 0 && (
        <p className="mt-1 text-xs text-muted">{summary.map(([label, value]) => `${label}: ${value}`).join(" · ")}</p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {signal.proposals.map((proposal) => (
          <ProposalRow
            key={`${proposal.intentId}-${proposal.fact}`}
            proposal={proposal}
            title={title}
            canReview={canReview}
            canDecide={canDecide}
            onReview={onReview}
            onDecided={onDecided}
          />
        ))}
      </ul>
    </li>
  );
}

function ProposalRow({
  proposal,
  title,
  canReview,
  canDecide,
  onReview,
  onDecided,
}: {
  proposal: SignalProposal;
  title: string;
  canReview: boolean;
  canDecide: boolean;
  onReview: (intent: AdoptedIntent) => void;
  onDecided: () => void;
}) {
  const { language } = useLanguage();
  const copy = healthCopy[language];
  const shared = signalsCopy[language];
  const [busy, setBusy] = useState<"review" | "dismiss" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = proposal.intentStatus ?? "unknown";
  const open = isOpenProposal(proposal.intentStatus);

  const review = async () => {
    setBusy("review");
    setError(null);
    const { ok, data } = await signalsApi.state(proposal.intentId);
    setBusy(null);
    if (ok && "state" in data) {
      onReview({
        intentId: proposal.intentId,
        scenarioId: SCENARIO_OF[proposal.fact],
        state: data.state,
        positionLabel: `${title} · ${copy.facts[proposal.fact]}`,
      });
      return;
    }
    setError("error" in data ? translateMessage(data.error) : copy.genericError);
  };

  const dismiss = async () => {
    setBusy("dismiss");
    setError(null);
    const { ok, data } = await signalsApi.dismiss(proposal.intentId);
    setBusy(null);
    if (ok) {
      setConfirming(false);
      onDecided();
      return;
    }
    setError("error" in data ? translateMessage(data.error) : copy.genericError);
  };

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-ink">{copy.facts[proposal.fact]}</span>
        <Badge variant={STATUS_VARIANT[status] ?? "neutral"} dot>
          {shared.status[status] ?? status}
        </Badge>
        {proposal.reused && <span className="text-xs text-muted">{shared.reused}</span>}
        {proposal.party && (
          <span className={proposal.party.outcome === "linked" ? "text-xs text-muted" : "text-xs font-medium text-warn"}>
            {shared.party[proposal.party.outcome](copy.partyRole[proposal.fact])}
          </span>
        )}
      </div>
      {open && proposal.suggestion === "no_obligation" && <p className="text-xs font-medium text-warn">{copy.suggestion}</p>}
      {proposal.dismissedBy && (
        <p className="text-xs text-muted">
          {copy.dismissed(proposal.dismissedByName ?? proposal.dismissedBy, proposal.dismissedAt ? formatDateTime(proposal.dismissedAt) : "—")}
        </p>
      )}
      {open && (canReview || (canDecide && canDismiss(proposal))) && (
        <div className="flex flex-wrap items-center gap-2">
          {canReview && !confirming && (
            <Button size="sm" variant="ghost" loading={busy === "review"} onClick={review}>
              {copy.review}
            </Button>
          )}
          {canDecide && canDismiss(proposal) && !confirming && (
            <Button size="sm" variant="warn" onClick={() => setConfirming(true)}>
              {copy.dismiss}
            </Button>
          )}
          {confirming && (
            <>
              <Button size="sm" variant="warn" loading={busy === "dismiss"} onClick={dismiss}>
                {copy.dismissConfirm}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === "dismiss"} onClick={() => setConfirming(false)}>
                {copy.dismissCancel}
              </Button>
              <span className="w-full text-xs text-muted sm:w-auto">{copy.dismissNote}</span>
            </>
          )}
        </div>
      )}
      {error && <span className="text-xs font-medium text-bad">{error}</span>}
    </li>
  );
}
