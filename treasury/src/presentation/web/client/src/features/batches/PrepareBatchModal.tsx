import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { batchesApi } from "@/features/batches/batchesApi";
import { batchesCopy } from "@/features/batches/batchesCopy";
import { lineProblem, selectionItems, selectionTotal, type Selection } from "@/features/batches/batchSelection";
import { translateMessage } from "@/features/operations/copy";
import { useLanguage } from "@/i18n/i18n";
import { formatMoneyForLanguage } from "@/utils/format";
import { amountDigits, maskedAmount } from "@/utils/money";

/** One display row of the selection: who, what, how much is open. */
export interface SelectionLabel {
  creditor: string;
  what: string;
}

/**
 * REQ-651: the chosen lines, each with what this payment puts on it — the open balance by default,
 * less for a partial payment, never more. Preparing sends nothing to the Ledger (REQ-239).
 */
export function PrepareBatchModal({
  selection,
  labelOf,
  onChange,
  onClose,
  onPrepared,
}: {
  selection: Selection;
  labelOf: (objectId: string) => SelectionLabel;
  onChange: (selection: Selection) => void;
  onClose: () => void;
  onPrepared: () => void;
}) {
  const { language } = useLanguage();
  const copy = batchesCopy[language];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = Object.values(selection);
  const blocked = chosen.some((c) => lineProblem(c) !== null);
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);

  const prepare = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await batchesApi.prepare(selectionItems(selection));
    setSaving(false);
    if (ok && "batchId" in data) return onPrepared();
    setError("error" in data ? translateMessage(data.error) : copy.genericError);
  };

  return (
    <Modal open onClose={onClose} title={copy.prepareTitle} closeLabel={copy.close} className="max-w-2xl">
      <p className="text-[13px] text-muted">{copy.prepareNote}</p>
      <ul className="mt-4 space-y-2">
        {chosen.map((c) => {
          const label = labelOf(c.line.objectId);
          const problem = lineProblem(c);
          return (
            <li key={c.line.objectId} className="flex flex-col gap-2 rounded-2xl border border-line px-3 py-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{label.creditor}</p>
                <p className="text-[12.5px] text-muted">
                  {label.what} · {money(c.line.openBalance ?? "0")}
                </p>
              </div>
              <div className="w-full sm:w-44">
                <Input
                  aria-label={`${copy.amount} ${label.creditor}`}
                  inputMode="numeric"
                  value={c.digits === "" ? "" : maskedAmount(c.digits)}
                  disabled={saving}
                  onChange={(e) => onChange({ ...selection, [c.line.objectId]: { ...c, digits: amountDigits(e.target.value) } })}
                />
                {problem && <p className="mt-1 text-[12px] font-medium text-bad">{copy[problem]}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">
        {copy.total}: <span className="tabular font-semibold text-ink">{money(selectionTotal(selection))}</span>
      </p>
      {error && <p className="mt-2 text-sm font-medium text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {copy.cancel}
        </Button>
        <Button loading={saving} disabled={blocked || chosen.length === 0} onClick={prepare}>
          {copy.confirmPrepare}
        </Button>
      </div>
    </Modal>
  );
}
