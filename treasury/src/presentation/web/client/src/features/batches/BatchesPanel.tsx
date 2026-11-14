import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { batchesApi, type Batch, type BatchesView, type StepStatus } from "@/features/batches/batchesApi";
import { batchesCopy } from "@/features/batches/batchesCopy";
import { debitMatches } from "@/features/batches/batchSelection";
import { translateMessage } from "@/features/operations/copy";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatMoneyForLanguage } from "@/utils/format";
import { amountDigits, amountFromDigits, maskedAmount } from "@/utils/money";

const STEP_VARIANT: Record<StepStatus, "ok" | "bad" | "warn" | "neutral"> = {
  accepted: "ok",
  rejected: "bad",
  awaiting_correction: "warn",
  failed: "bad",
  not_sent: "neutral",
};

/** The value of the "not stated" option; the API receives it as null (REQ-650). */
const NOT_STATED = "__none__";

/** Today in São Paulo, the day the CFO means (REQ-225). */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/**
 * §8.6: the prepared batches, waiting for the bank, and the ones paid lately with each line's outcome.
 * Recording the payment sends one event per line (REQ-653); the result stays on the batch.
 */
export function BatchesPanel({
  view,
  canPay,
  onChanged,
}: {
  view: BatchesView;
  canPay: boolean;
  onChanged: () => void;
}) {
  const { language } = useLanguage();
  const copy = batchesCopy[language];
  const [paying, setPaying] = useState<Batch | null>(null);
  const [result, setResult] = useState<Batch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const institutionName = (key: string | null) => (key === null ? copy.notStated : view.institutions.find((i) => i.key === key)?.name ?? key);

  const discard = async (batch: Batch) => {
    if (!window.confirm(copy.discardConfirm)) return;
    setBusy(batch.batchId);
    setError(null);
    const { ok, data } = await batchesApi.discard(batch.batchId);
    setBusy(null);
    if (!ok) setError("error" in data ? translateMessage(data.error) : copy.genericError);
    onChanged();
  };

  if (view.standing.length === 0 && view.recent.length === 0) return null;

  return (
    <div className="space-y-4">
      {view.standing.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink">{copy.standingTitle}</h3>
          <p className="mt-1 text-[13px] text-muted">{copy.standingNote}</p>
          {error && <p className="mt-2 text-sm font-medium text-bad">{error}</p>}
          <ul className="mt-3 space-y-3">
            {view.standing.map((batch) => (
              <li key={batch.batchId} className="rounded-2xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="tabular font-display text-lg font-semibold text-ink">{money(batch.total)}</p>
                    <p className="text-[12.5px] text-muted">
                      {copy.lines(batch.lines.length)} · {copy.preparedBy(batch.preparedBy, formatDateTime(batch.preparedAt))}
                    </p>
                  </div>
                  {canPay && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" loading={busy === batch.batchId} onClick={() => discard(batch)}>
                        {copy.discard}
                      </Button>
                      <Button size="sm" onClick={() => setPaying(batch)}>
                        {copy.pay}
                      </Button>
                    </div>
                  )}
                </div>
                <Lines batch={batch} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view.recent.length > 0 && (
        <Card>
          <details>
            <summary className="cursor-pointer font-display text-lg font-semibold text-ink">{copy.recentTitle}</summary>
            <ul className="mt-3 space-y-3">
              {view.recent.map((batch) => (
                <li key={batch.batchId} className="rounded-2xl border border-line p-3">
                  <Outcome batch={batch} institutionName={institutionName} />
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      {paying && (
        <PayModal
          batch={paying}
          view={view}
          onClose={() => setPaying(null)}
          onPaid={(paid) => {
            setPaying(null);
            setResult(paid);
            onChanged();
          }}
        />
      )}

      {result && (
        <Modal open onClose={() => setResult(null)} title={copy.recentTitle} closeLabel={copy.close} className="max-w-2xl">
          <Outcome batch={result} institutionName={institutionName} />
        </Modal>
      )}
    </div>
  );
}

function Lines({ batch }: { batch: Batch }) {
  const { language, t } = useLanguage();
  const copy = batchesCopy[language];
  return (
    <ul className="mt-2 divide-y divide-line text-[13px]">
      {batch.lines.map((line) => (
        <li key={line.objectId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{line.payee?.displayName ?? copy.unknownPayee}</span>
          <span className="text-muted">{line.objectType ? t.objectType[line.objectType] ?? line.objectType : ""}</span>
          <span className="tabular text-ink">{formatMoneyForLanguage(line.amount, "BRL", language)}</span>
          {line.step && (
            <Badge variant={STEP_VARIANT[line.step.status]} title={line.step.reason}>
              {copy.steps[line.step.status]}
            </Badge>
          )}
          {line.step?.reason && line.step.status !== "accepted" && (
            <span className="basis-full text-[12px] text-bad">{translateMessage(line.step.reason)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Outcome({ batch, institutionName }: { batch: Batch; institutionName: (key: string | null) => string }) {
  const { language } = useLanguage();
  const copy = batchesCopy[language];
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const payment = batch.payment!;
  const gap = payment.difference !== "0.00";
  return (
    <>
      <p className="tabular font-display text-lg font-semibold text-ink">{money(payment.debit)}</p>
      <p className="text-[12.5px] text-muted">{copy.paidOn(formatDate(`${payment.occurredAt}T12:00:00`), institutionName(payment.institution))}</p>
      <p className="mt-1 text-[13px] text-muted">
        {copy.recorded}: <span className="tabular font-semibold text-ink">{money(payment.recorded)}</span>
        {" · "}
        {copy.difference}: <span className={cn("tabular font-semibold", gap ? "text-bad" : "text-ink")}>{money(payment.difference)}</span>
      </p>
      <Lines batch={batch} />
      {gap && <p className="mt-2 text-[12.5px] text-warn">{copy.fixHint}</p>}
    </>
  );
}

function PayModal({ batch, view, onClose, onPaid }: { batch: Batch; view: BatchesView; onClose: () => void; onPaid: (batch: Batch) => void }) {
  const { language } = useLanguage();
  const copy = batchesCopy[language];
  const [date, setDate] = useState(today());
  const [institution, setInstitution] = useState("");
  const [debitDigits, setDebitDigits] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = formatMoneyForLanguage(batch.total, "BRL", language);
  const matches = debitMatches(debitDigits, batch.total);

  const pay = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await batchesApi.pay(batch.batchId, {
      occurredAt: date,
      institution: institution === NOT_STATED ? null : institution,
      debit: amountFromDigits(debitDigits),
    });
    setSaving(false);
    if (ok && "batchId" in data) return onPaid(data);
    setError("error" in data ? translateMessage(data.error) : copy.genericError);
  };

  return (
    <Modal open onClose={onClose} title={copy.payTitle} closeLabel={copy.close} className="max-w-xl">
      <p className="text-[13px] text-muted">{copy.payNote}</p>
      <p className="mt-3 text-sm text-muted">
        {copy.total}: <span className="tabular font-semibold text-ink">{total}</span> · {copy.lines(batch.lines.length)}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">{copy.date}</span>
          <DatePicker value={date} onChange={setDate} disabled={saving} />
        </div>
        <Input
          label={copy.debit}
          inputMode="numeric"
          value={debitDigits === "" ? "" : maskedAmount(debitDigits)}
          disabled={saving}
          onChange={(e) => setDebitDigits(amountDigits(e.target.value))}
        />
        <div className="sm:col-span-2">
          <Select
            label={copy.institution}
            value={institution}
            onChange={setInstitution}
            options={[
              { value: "", label: copy.chooseInstitution },
              ...view.institutions.map((i) => ({ value: i.key, label: i.name })),
              { value: NOT_STATED, label: copy.notStated },
            ]}
          />
          {institution === NOT_STATED && <p className="mt-1 text-[12px] text-warn">{copy.notStatedHint}</p>}
        </div>
      </div>
      {debitDigits !== "" && !matches && <p className="mt-3 text-sm font-medium text-bad">{copy.debitMismatch(total)}</p>}
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {copy.cancel}
        </Button>
        <Button loading={saving} disabled={!date || !institution || !matches} onClick={pay}>
          {copy.confirmPay}
        </Button>
      </div>
    </Modal>
  );
}
