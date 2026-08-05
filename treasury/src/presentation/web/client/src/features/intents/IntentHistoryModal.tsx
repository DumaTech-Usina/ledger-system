import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { eventLabels } from "@/features/operations/copy";
import { operationsApi } from "@/features/operations/operationsApi";
import { useLanguage } from "@/i18n/i18n";
import { formatDateTime } from "@/utils/format";
import type { AuditEntry } from "@/types/operations";

/**
 * One entry's append-only history. It is the intent's own trail — every question answered, every
 * identity decided, what the Ledger said — in the order it happened, and nothing is derived here.
 */
export function IntentHistoryModal({
  intentId,
  title,
  onClose,
}: {
  intentId: string;
  title: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [history, setHistory] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    operationsApi
      .getIntent(intentId)
      .then(({ ok, data }) => {
        if (!cancelled) setHistory(ok ? data.history : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  return (
    <Modal open onClose={onClose} title={title} closeLabel={t.common.close} className="max-w-lg">
      <div className="px-5 py-5">
        {history === null ? (
          <p className="text-sm text-muted">{t.common.loading}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted">{t.intents.noHistory}</p>
        ) : (
          <ul className="space-y-3">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="text-[13.5px] font-medium text-ink">{eventLabels[entry.type] ?? entry.type}</div>
                {entry.detail && <div className="text-[12px] text-muted">{entry.detail}</div>}
                <div className="tabular text-[11px] text-muted">{formatDateTime(entry.at)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
