import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { cashApi, type InstitutionView, type InstitutionsResult, type RecordOutcome, type StatementCheck } from "@/features/cash/cashApi";
import { cashCopy } from "@/features/cash/cashCopy";
import { checkTone, signedAmount, todayInSaoPaulo } from "@/features/cash/cashView";
import { translateMessage } from "@/features/operations/copy";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatMoneyForLanguage } from "@/utils/format";
import { amountDigits, amountFromDigits, maskedAmount } from "@/utils/money";

type Loaded = Extract<InstitutionsResult, { available: true }>;
type Dialog = { kind: "opening" | "statement"; institution: InstitutionView } | { kind: "transfer" } | null;

const dayLabel = (ymd: string) => formatDate(`${ymd}T12:00:00`);

/**
 * §8.8: how much is in each institution, from its opening balance (REQ-670–673), and the bank check
 * (REQ-675). The balances and the totals are the Ledger's; the only figure made here is the difference
 * between a statement and the book on the same day.
 */
export function CashPage({ canWrite }: { canWrite: boolean }) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  const [asOf, setAsOf] = useState(todayInSaoPaulo());
  const [view, setView] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "failed">("loading");
  const [dialog, setDialog] = useState<Dialog>(null);
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);

  const load = useCallback(async (day: string) => {
    try {
      const { ok, data } = await cashApi.read(day);
      if (!ok || !("available" in data)) return setState("failed");
      if (!data.available) return setState("unavailable");
      setView(data);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    void load(asOf);
  }, [asOf, load]);

  const done = () => {
    setDialog(null);
    void load(asOf);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-ink">{copy.heading}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{copy.subheading(dayLabel(asOf))}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-full flex-col gap-1.5 sm:w-48">
            <span className="text-[13px] font-semibold text-muted">{copy.asOf}</span>
            <DatePicker value={asOf} onChange={(d) => d && setAsOf(d)} />
          </div>
          {canWrite && view && (
            <Button onClick={() => setDialog({ kind: "transfer" })}>{copy.transfer}</Button>
          )}
        </div>
      </div>

      {state === "unavailable" && <Banner variant="bad">{copy.unavailable}</Banner>}
      {state === "failed" && <Banner variant="bad">{copy.loadError}</Banner>}

      {view && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="glass rounded-2xl border border-line px-4 py-3">
              <span className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{copy.knownTotal}</span>
              <p className="tabular mt-1 font-display text-2xl font-semibold text-ink">
                {view.known.institutions.length === 0 ? copy.unknownBalance : money(view.known.total)}
              </p>
              <p className="text-[12.5px] text-muted">{copy.knownOf(view.known.institutions)}</p>
            </div>
            <div className="glass rounded-2xl border border-dashed border-line px-4 py-3">
              <span className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{copy.unknownTitle}</span>
              <p className="mt-1 text-sm text-ink">
                {copy.cashIn}: <span className="tabular font-semibold">{money(view.unknown.cashIn)}</span>
                {" · "}
                {copy.cashOut}: <span className="tabular font-semibold">{money(view.unknown.cashOut)}</span>
                {" · "}
                <span className="text-muted">{copy.unknownCount(view.unknown.count)}</span>
              </p>
              <p className="mt-1 text-[12.5px] text-muted">{copy.unknownNote(view.unknown.since ? dayLabel(view.unknown.since) : null)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {view.institutions.map((institution) => (
              <InstitutionCard
                key={institution.key}
                institution={institution}
                canWrite={canWrite}
                onOpening={() => setDialog({ kind: "opening", institution })}
                onStatement={() => setDialog({ kind: "statement", institution })}
              />
            ))}
          </div>
        </>
      )}

      {dialog?.kind === "opening" && <OpeningModal institution={dialog.institution} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "statement" && <StatementModal institution={dialog.institution} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "transfer" && view && (
        <TransferModal institutions={view.institutions.filter((i) => i.configured)} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}

function InstitutionCard({
  institution: i,
  canWrite,
  onOpening,
  onStatement,
}: {
  institution: InstitutionView;
  canWrite: boolean;
  onOpening: () => void;
  onStatement: () => void;
}) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const [history, setHistory] = useState<StatementCheck[] | null>(null);
  const negative = i.balance?.startsWith("-") ?? false;

  const toggleHistory = async () => {
    if (history) return setHistory(null);
    const { ok, data } = await cashApi.history(i.key);
    setHistory(ok && "statements" in data ? data.statements : []);
  };

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold text-ink">{i.name}</h3>
          {!i.configured && <Badge variant="warn">{copy.notConfigured}</Badge>}
        </div>
        <div className="text-right">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{copy.balance}</span>
          <p className={cn("tabular font-display text-2xl font-semibold", i.balance === null ? "text-muted" : negative ? "text-bad" : "text-ink")}>
            {i.balance === null ? copy.unknownBalance : money(i.balance)}
          </p>
        </div>
      </div>

      {i.opening ? (
        <p className="mt-1 text-[12.5px] text-muted">{copy.opening(dayLabel(i.opening.day), money(i.opening.amount))}</p>
      ) : (
        <div className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-[12.5px] text-ink">
          <p>{copy.noOpening}</p>
          {canWrite && (
            <Button size="sm" className="mt-2" onClick={onOpening}>
              {copy.registerOpening}
            </Button>
          )}
        </div>
      )}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {(
          [
            [copy.cashIn, i.cashIn],
            [copy.cashOut, i.cashOut],
            [copy.transfersIn, i.transfersIn],
            [copy.transfersOut, i.transfersOut],
          ] as const
        ).map(([label, amount]) => (
          <div key={label} className="flex min-w-0 justify-between gap-2">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular text-ink">{money(amount)}</dd>
          </div>
        ))}
      </dl>
      {i.opening && <p className="mt-1 text-[11.5px] text-muted">{copy.sinceOpening}</p>}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-ink">{copy.statementTitle}</h4>
          {canWrite && i.configured && (
            <Button size="sm" variant="ghost" onClick={onStatement}>
              {copy.informStatement}
            </Button>
          )}
        </div>
        {i.statement ? <Check check={i.statement} /> : <p className="mt-1 text-[12.5px] text-muted">{copy.noStatement}</p>}
        {i.statement && (
          <button type="button" className="mt-2 text-[12.5px] font-semibold text-accent hover:underline" onClick={toggleHistory}>
            {copy.history}
          </button>
        )}
        {history && (
          <ul className="mt-2 space-y-2">
            {history.map((h, n) => (
              <li key={n} className="rounded-xl border border-line px-3 py-2">
                <Check check={h} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Check({ check }: { check: StatementCheck }) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const tone = checkTone(check.difference);
  return (
    <div className="mt-1 space-y-0.5 text-[13px]">
      <p className="text-ink">{copy.statementLine(dayLabel(check.day), money(check.amount))}</p>
      <p className="text-muted">{check.book === null ? copy.bookUnknown : copy.bookLine(money(check.book))}</p>
      {tone === "ok" && <Badge variant="ok">{copy.matches}</Badge>}
      {tone === "bad" && (
        <p className="font-semibold text-bad">
          {copy.difference}: <span className="tabular">{money(check.difference!)}</span>
        </p>
      )}
      <p className="text-[11.5px] text-muted">{copy.informedBy(check.informedBy, formatDateTime(check.informedAt))}</p>
    </div>
  );
}

/** Shared tail of the three forms: the error, and cancel/confirm. */
function Actions({ saving, disabled, error, onCancel, onConfirm }: { saving: boolean; disabled: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  return (
    <>
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {copy.cancel}
        </Button>
        <Button loading={saving} disabled={disabled} onClick={onConfirm}>
          {copy.confirm}
        </Button>
      </div>
    </>
  );
}

/** What a write answered: an error, a Ledger refusal, or done. */
function useWrite(onDone: () => void) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (call: () => Promise<{ ok: boolean; data: unknown }>) => {
    setSaving(true);
    setError(null);
    try {
      const { ok, data } = await call();
      if (!ok) return setError(data && typeof data === "object" && "error" in data ? translateMessage(String((data as { error: string }).error)) : copy.genericError);
      const outcome = data as Partial<RecordOutcome>;
      if (outcome.status && outcome.status !== "accepted") return setError(copy.refused(translateMessage(outcome.reason ?? outcome.status)));
      onDone();
    } catch {
      setError(copy.genericError);
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

function SideAndAmount({ negative, setNegative, digits, setDigits, label, disabled }: { negative: boolean; setNegative: (v: boolean) => void; digits: string; setDigits: (v: string) => void; label: string; disabled: boolean }) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label={label}
        inputMode="numeric"
        value={digits === "" ? "" : `${negative ? "−" : ""}${maskedAmount(digits)}`}
        disabled={disabled}
        onChange={(e) => setDigits(amountDigits(e.target.value))}
      />
      <Select
        label={copy.balance}
        value={negative ? "overdrawn" : "positive"}
        onChange={(v) => setNegative(v === "overdrawn")}
        options={[
          { value: "positive", label: copy.positive },
          { value: "overdrawn", label: copy.overdrawn },
        ]}
      />
    </div>
  );
}

function OpeningModal({ institution, onClose, onDone }: { institution: InstitutionView; onClose: () => void; onDone: () => void }) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  const [day, setDay] = useState(todayInSaoPaulo());
  const [digits, setDigits] = useState("");
  const [negative, setNegative] = useState(false);
  const { saving, error, run } = useWrite(onDone);
  return (
    <Modal open onClose={onClose} title={copy.openingTitle(institution.name)} closeLabel={copy.close} className="max-w-xl">
      <div className="p-5">
      <p className="text-[13px] text-muted">{copy.openingNote}</p>
      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">{copy.day}</span>
          <DatePicker value={day} onChange={setDay} disabled={saving} />
        </div>
        <SideAndAmount negative={negative} setNegative={setNegative} digits={digits} setDigits={setDigits} label={copy.statementAmount} disabled={saving} />
      </div>
      <Actions
        saving={saving}
        error={error}
        disabled={!day || digits === "" || amountFromDigits(digits) === "0.00"}
        onCancel={onClose}
        onConfirm={() => run(() => cashApi.opening({ institution: institution.key, amount: signedAmount(digits, negative), occurredAt: day }))}
      />
    </div>
    </Modal>
  );
}

function StatementModal({ institution, onClose, onDone }: { institution: InstitutionView; onClose: () => void; onDone: () => void }) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  const [day, setDay] = useState(todayInSaoPaulo());
  const [digits, setDigits] = useState("");
  const [negative, setNegative] = useState(false);
  const { saving, error, run } = useWrite(onDone);
  return (
    <Modal open onClose={onClose} title={copy.statementTitleOf(institution.name)} closeLabel={copy.close} className="max-w-xl">
      <div className="p-5">
      <p className="text-[13px] text-muted">{copy.statementNote}</p>
      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">{copy.day}</span>
          <DatePicker value={day} onChange={setDay} disabled={saving} />
        </div>
        <SideAndAmount negative={negative} setNegative={setNegative} digits={digits} setDigits={setDigits} label={copy.statementAmount} disabled={saving} />
      </div>
      <Actions
        saving={saving}
        error={error}
        disabled={!day || digits === ""}
        onCancel={onClose}
        onConfirm={() => run(() => cashApi.statement({ institution: institution.key, day, amount: signedAmount(digits, negative) }))}
      />
    </div>
    </Modal>
  );
}

function TransferModal({ institutions, onClose, onDone }: { institutions: InstitutionView[]; onClose: () => void; onDone: () => void }) {
  const { language } = useLanguage();
  const copy = cashCopy[language];
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [day, setDay] = useState(todayInSaoPaulo());
  const [digits, setDigits] = useState("");
  const [description, setDescription] = useState("");
  const { saving, error, run } = useWrite(onDone);
  const options = [{ value: "", label: copy.choose }, ...institutions.map((i) => ({ value: i.key, label: i.name }))];
  const same = from !== "" && from === to;
  return (
    <Modal open onClose={onClose} title={copy.transferTitle} closeLabel={copy.close} className="max-w-xl">
      <div className="p-5">
      <p className="text-[13px] text-muted">{copy.transferNote}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select label={copy.from} value={from} onChange={setFrom} options={options} />
        <Select label={copy.to} value={to} onChange={setTo} options={options} />
        <Input
          label={copy.amount}
          inputMode="numeric"
          value={digits === "" ? "" : maskedAmount(digits)}
          disabled={saving}
          onChange={(e) => setDigits(amountDigits(e.target.value))}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">{copy.day}</span>
          <DatePicker value={day} onChange={setDay} disabled={saving} />
        </div>
        <div className="sm:col-span-2">
          <Input label={copy.description} value={description} disabled={saving} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      {same && <p className="mt-3 text-sm font-medium text-bad">{copy.sameInstitution}</p>}
      <Actions
        saving={saving}
        error={error}
        disabled={!from || !to || same || !day || digits === "" || amountFromDigits(digits) === "0.00"}
        onCancel={onClose}
        onConfirm={() => run(() => cashApi.transfer({ from, to, amount: amountFromDigits(digits), occurredAt: day, description }))}
      />
    </div>
    </Modal>
  );
}
