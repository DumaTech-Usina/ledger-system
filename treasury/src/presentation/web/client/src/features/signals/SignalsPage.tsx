import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { translateMessage } from "@/features/operations/copy";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useLanguage } from "@/i18n/i18n";
import { formatDateTime, formatMoneyForLanguage } from "@/utils/format";
import { amountDigits, maskedAmount } from "@/utils/money";
import {
  SCENARIO_OF,
  SIGNAL_FORM,
  isOpenProposal,
  missingRequired,
  signalPayload,
} from "./signalForm";
import {
  signalsApi,
  type SignalKind,
  type SignalProposal,
  type SignalView,
} from "./signalsApi";
import { signalsCopy } from "./signalsCopy";
import { PolicySituationPanel } from "./PolicySituationPanel";
import { InsurerCreditCard } from "./InsurerCreditCard";

const STATUS_VARIANT: Record<
  string,
  "neutral" | "accent" | "ok" | "bad" | "warn"
> = {
  gathering: "warn",
  awaiting_confirmation: "accent",
  awaiting_correction: "warn",
  accepted: "ok",
  rejected: "bad",
};

/**
 * §4.6, block A: the user copies what the insurance system's screen shows, and each fact it reports
 * becomes a proposal that is reviewed and submitted in the ordinary conversation (REQ-261). Nothing
 * here sends anything to the Ledger.
 */
export function SignalsPage({
  canCreate,
  canSubmit = false,
  onReview,
}: {
  canCreate: boolean;
  /** Recording an insurer credit sends receipts to the Ledger, so it needs the submit permission. */
  canSubmit?: boolean;
  onReview: (intent: AdoptedIntent) => void;
}) {
  const { language } = useLanguage();
  const copy = signalsCopy[language];
  const [signals, setSignals] = useState<SignalView[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await signalsApi.list();
    if (ok && "signals" in data) {
      setSignals(data.signals);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">
          {copy.heading}
        </h2>
        <p className="mt-1 text-sm text-muted">{copy.subheading}</p>
      </div>

      {canCreate && (
        <RegisterSignal
          onRegistered={load}
          startOpen={signals !== null && signals.length === 0}
        />
      )}

      {canSubmit && <InsurerCreditCard onRecorded={load} />}

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">
          {copy.listTitle}
        </h3>
        <p className="mt-1 text-xs text-muted">{copy.notAFact}</p>
        {loadError && (
          <p className="mt-3 text-sm font-medium text-bad">{copy.loadError}</p>
        )}
        {signals !== null && signals.length === 0 && (
          <p className="mt-3 text-sm text-muted">{copy.listEmpty}</p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {(signals ?? []).map((signal) => (
            <SignalItem
              key={signal.id}
              signal={signal}
              canReview={canCreate}
              onReview={onReview}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function RegisterSignal({
  onRegistered,
  startOpen,
}: {
  onRegistered: () => void;
  startOpen: boolean;
}) {
  const { language } = useLanguage();
  const copy = signalsCopy[language];
  // Collapsed once there is something to read below; open when the list is still empty.
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? startOpen;
  const [kind, setKind] = useState<SignalKind>("eligibility");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDone(false);
  };

  const register = async () => {
    const missing = missingRequired(kind, values);
    if (missing.length > 0) {
      setError(copy.missing(missing.map((key) => copy.fields[key]).join(", ")));
      return;
    }
    setSaving(true);
    setError(null);
    const { ok, data } = await signalsApi.register(
      kind,
      signalPayload(kind, values),
    );
    setSaving(false);
    if (ok) {
      setValues({});
      setDone(true);
      onRegistered();
      return;
    }
    setError(
      "error" in data ? translateMessage(data.error) : copy.genericError,
    );
  };

  return (
    // Lifted above the list: each glass card isolates its own layers, so without this the date
    // picker's panel would open underneath the card that follows.
    <Card className="z-10">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h3 className="font-display text-lg font-semibold text-ink">
          {copy.registerTitle}
        </h3>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted transition-transform",
            expanded && "rotate-180",
          )}
          strokeWidth={1.5}
        />
      </button>
      {done && !expanded && (
        <p className="mt-2 text-sm font-medium text-ok">{copy.registered}</p>
      )}
      {expanded && (
        <>
          <div className="mt-4 max-w-md">
            <Select
              label={copy.kind}
              value={kind}
              onChange={(value) => {
                setKind(value === "policy" ? "policy" : "eligibility");
                setDone(false);
              }}
              options={[
                { value: "eligibility", label: copy.kinds.eligibility },
                { value: "policy", label: copy.kinds.policy },
              ]}
            />
            <p className="mt-2 text-xs text-muted">{copy.kindNote[kind]}</p>
            <p className="mt-1 text-xs text-muted">{copy.brokerIdNote}</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {SIGNAL_FORM[kind].map((field) => {
              const label = `${copy.fields[field.key]}${field.required ? ` · ${copy.required}` : ""}`;
              const value = values[field.key] ?? "";
              if (field.format === "date") {
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-muted">
                      {label}
                    </span>
                    <DatePicker
                      value={value}
                      onChange={(v) => set(field.key, v)}
                      disabled={saving}
                    />
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
                    onChange={(e) =>
                      set(field.key, amountDigits(e.target.value))
                    }
                  />
                );
              }
              return (
                <Input
                  key={field.key}
                  label={label}
                  inputMode={field.format === "percent" ? "decimal" : undefined}
                  value={value}
                  disabled={saving}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              );
            })}
          </div>
          {error && (
            <p className="mt-3 text-sm font-medium text-bad">{error}</p>
          )}
          {done && (
            <p className="mt-3 text-sm font-medium text-ok">
              {copy.registered}
            </p>
          )}
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

function SignalItem({
  signal,
  canReview,
  onReview,
}: {
  signal: SignalView;
  canReview: boolean;
  onReview: (intent: AdoptedIntent) => void;
}) {
  const { language } = useLanguage();
  const copy = signalsCopy[language];
  const policy = signal.fields.policyNumber ?? signal.recordId;
  const [showSituation, setShowSituation] = useState(false);
  const money = (key: string) =>
    signal.fields[key]
      ? formatMoneyForLanguage(signal.fields[key], "BRL", language)
      : null;
  const facts = [
    [copy.fields.usinaValue, money("usinaValue")],
    [copy.fields.payout, money("payout")],
    [copy.fields.insurer, signal.fields.insurer],
    [copy.fields.broker, signal.fields.broker],
  ].filter((pair): pair is [string, string] => Boolean(pair[1]));

  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {copy.kinds[signal.kind]} · {copy.policy}{" "}
          <span className="font-mono">{policy}</span>
        </p>
        <p className="text-xs text-muted">
          {copy.receivedAt(
            formatDateTime(signal.receivedAt),
            copy.author(signal.recordedBy),
          )}
        </p>
      </div>
      {facts.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          {facts.map(([label, value]) => `${label}: ${value}`).join(" · ")}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {signal.proposals.map((proposal) => (
          <ProposalRow
            key={`${proposal.intentId}-${proposal.fact}`}
            proposal={proposal}
            policy={policy}
            canReview={canReview}
            onReview={onReview}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setShowSituation((v) => !v)}
        className="mt-3 text-[13px] font-semibold text-accent transition hover:underline"
      >
        {showSituation ? copy.situation.hide : copy.situation.show}
      </button>
      {showSituation && (
        <PolicySituationPanel
          policyId={signal.recordId}
          policyLabel={`${copy.policy} ${policy}`}
          canAct={canReview}
          onReview={onReview}
        />
      )}
    </li>
  );
}

function ProposalRow({
  proposal,
  policy,
  canReview,
  onReview,
}: {
  proposal: SignalProposal;
  policy: string;
  canReview: boolean;
  onReview: (intent: AdoptedIntent) => void;
}) {
  const { language } = useLanguage();
  const copy = signalsCopy[language];
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = proposal.intentStatus ?? "unknown";

  const review = async () => {
    setOpening(true);
    setError(null);
    const { ok, data } = await signalsApi.state(proposal.intentId);
    setOpening(false);
    if (ok && "state" in data) {
      onReview({
        intentId: proposal.intentId,
        scenarioId: SCENARIO_OF[proposal.fact],
        state: data.state,
        positionLabel: `${copy.policy} ${policy} · ${copy.facts[proposal.fact]}`,
      });
      return;
    }
    setError(
      "error" in data ? translateMessage(data.error) : copy.genericError,
    );
  };

  return (
    <li className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-ink">{copy.facts[proposal.fact]}</span>
      <Badge variant={STATUS_VARIANT[status] ?? "neutral"} dot>
        {copy.status[status] ?? status}
      </Badge>
      {proposal.reused && (
        <span className="text-xs text-muted">{copy.reused}</span>
      )}
      {proposal.party && (
        <span
          className={
            proposal.party.outcome === "linked"
              ? "text-xs text-muted"
              : "text-xs font-medium text-warn"
          }
        >
          {copy.party[proposal.party.outcome](copy.partyRole[proposal.fact])}
        </span>
      )}
      {canReview && isOpenProposal(proposal.intentStatus) && (
        <Button size="sm" variant="ghost" loading={opening} onClick={review}>
          {copy.review}
        </Button>
      )}
      {error && <span className="text-xs font-medium text-bad">{error}</span>}
    </li>
  );
}
