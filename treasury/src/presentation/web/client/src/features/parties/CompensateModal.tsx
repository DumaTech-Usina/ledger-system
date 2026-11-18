import { useState } from "react";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { translateMessage } from "@/features/operations/copy";
import { partiesApi } from "@/features/parties/partiesApi";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { compensationProblem, openAfter, type PickedLine } from "@/features/parties/partiesEngine";
import { useLanguage } from "@/i18n/i18n";
import { toISO } from "@/utils/dateRange";
import { formatMoneyForLanguage } from "@/utils/format";
import { amountDigits, amountFromDigits, digitsFromAmount, maskedAmount } from "@/utils/money";

/**
 * REQ-693: the compensation of one pair, confirmed on the party's page. The amount starts at the
 * pair's maximum and is the user's to change (REQ-257); before confirming, each position shows what
 * it leaves open, and that cash does not move. One event, sent through the same path as every other
 * operation; the user stays on the page.
 */
export function CompensateModal({
  party,
  receivable,
  payable,
  max,
  onClose,
  onCompensated,
}: {
  party: { partyId: string; displayName: string };
  receivable: PickedLine;
  payable: PickedLine;
  max: string;
  onClose: () => void;
  onCompensated: () => void;
}) {
  const { t, language } = useLanguage();
  const copy = partiesCopy[language];
  const [digits, setDigits] = useState(digitsFromAmount(max));
  const [date, setDate] = useState(toISO(new Date()));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const problem = compensationProblem(digits, max);
  const kind = (line: PickedLine) => t.objectType[line.objectType] ?? line.objectType;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const { ok, data } = await partiesApi.compensate({
        partyId: party.partyId,
        receivableId: receivable.objectId,
        payableId: payable.objectId,
        amount: amountFromDigits(digits),
        occurredAt: date,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      if (ok && "status" in data && data.status === "accepted") return onCompensated();
      if ("status" in data) setError(copy.compensationRefused(translateMessage(data.reason ?? "")));
      else setError("error" in data ? translateMessage(data.error) : copy.compensationFailed);
    } catch {
      setError(copy.compensationFailed);
    } finally {
      setSaving(false);
    }
  };

  const side = (title: string, line: PickedLine) => {
    const after = openAfter(line.openBalance ?? "0", problem === "over" ? "0" : digits);
    return (
      <li className="rounded-2xl border border-line px-3 py-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{kind(line)}</p>
        <p className="tabular mt-0.5 text-[13px] text-muted">
          {copy.openNow} {money(line.openBalance ?? "0")} → {copy.remains}{" "}
          <span className="font-semibold text-ink">{after === null ? t.common.unknown : money(after)}</span>
        </p>
      </li>
    );
  };

  return (
    <Modal open onClose={onClose} title={copy.compensateTitle} closeLabel={t.common.close} className="max-w-xl">
      <div className="space-y-4 p-5">
        <p className="text-[13px] text-muted">{copy.compensateNote}</p>
        <ul className="space-y-2">
          {side(copy.receivableSide(party.displayName), receivable)}
          {side(copy.payableSide(party.displayName), payable)}
        </ul>
        <p className="text-[13px] font-medium text-ink">{copy.cashUnchanged}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label={copy.amountLabel(money(max))}
              inputMode="numeric"
              value={digits === "" ? "" : maskedAmount(digits)}
              disabled={saving}
              onChange={(e) => setDigits(amountDigits(e.target.value))}
            />
            {problem && (
              <p className="mt-1 text-[12px] font-medium text-bad">
                {problem === "zero" ? copy.amountZero : copy.amountOver(money(max))}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">{copy.agreedOn}</span>
            <DatePicker value={date} onChange={setDate} disabled={saving} />
          </div>
        </div>
        <Input
          label={copy.descriptionLabel}
          value={description}
          disabled={saving}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && <p className="text-sm font-medium text-bad">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {copy.cancel}
          </Button>
          <Button loading={saving} disabled={problem !== null || date === ""} onClick={confirm}>
            {copy.confirmCompensation}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
