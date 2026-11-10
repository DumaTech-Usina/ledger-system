import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { operationsApi } from "@/features/operations/operationsApi";
import { translateMessage } from "@/features/operations/copy";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useLanguage } from "@/i18n/i18n";
import { formatDateForLanguage, formatMoneyForLanguage } from "@/utils/format";
import { signalsApi, type PolicyHistoryEntry, type PolicySituation } from "./signalsApi";
import { signalsCopy } from "./signalsCopy";

/**
 * §4.6 block C: what the Ledger knows about one policy, read when asked. Every figure is the
 * Ledger's; the only one this screen derives is the retained amount, and it says so (REQ-264).
 */
export function PolicySituationPanel({
  policyId,
  policyLabel,
  canAct,
  onReview,
}: {
  policyId: string;
  policyLabel: string;
  canAct: boolean;
  onReview: (intent: AdoptedIntent) => void;
}) {
  const { language } = useLanguage();
  const copy = signalsCopy[language].situation;
  const [situation, setSituation] = useState<PolicySituation | null>(null);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const money = (amount: string | null) =>
    amount === null ? copy.unknown : formatMoneyForLanguage(amount, "BRL", language);

  useEffect(() => {
    let alive = true;
    void signalsApi.situation(policyId).then(({ ok, data }) => {
      if (!alive) return;
      if (ok && "policyId" in data) setSituation(data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [policyId]);

  const start = async (action: PolicySituation["actions"][number]) => {
    setOpening(action.objectId);
    setError(null);
    const { ok, data } = await operationsApi.startPositionAction(action.objectId, action.scenarioId);
    setOpening(null);
    if (ok && "intentId" in data) {
      onReview({
        intentId: data.intentId,
        scenarioId: action.scenarioId,
        state: data.state,
        positionLabel: `${policyLabel} · ${action.kind === "receive" ? copy.receive : copy.pay}`,
      });
      return;
    }
    setError("error" in data ? translateMessage(data.error) : copy.loadError);
  };

  if (failed) return <p className="mt-3 text-sm font-medium text-bad">{copy.loadError}</p>;
  if (!situation) {
    return <div className="mt-3 size-5 animate-spin rounded-full border-2 border-muted border-t-accent" />;
  }

  const { expected, obligation } = situation;
  return (
    <div className="mt-3 rounded-2xl bg-ink/[0.03] p-4 dark:bg-white/5">
      <p className="text-[13px] font-semibold text-muted">{copy.title}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Figures
          title={copy.expected}
          rows={
            expected && [
              [copy.originated, money(expected.originated)],
              [copy.received, money(expected.received)],
              [copy.open, money(expected.open)],
              ...(expected.dueAt ? [[copy.dueAt, formatDateForLanguage(expected.dueAt, language)] as [string, string]] : []),
            ]
          }
          empty={copy.notRecorded}
        />
        <Figures
          title={copy.obligation}
          rows={
            obligation && [
              [copy.owed, money(obligation.owed)],
              [copy.paid, money(obligation.paid)],
              [copy.open, money(obligation.open)],
            ]
          }
          empty={copy.notRecorded}
        />
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-semibold text-ink">{copy.retained}</span>
          <span className="tabular font-semibold text-ink">{situation.retained === null ? copy.unknown : money(situation.retained)}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">{situation.retained === null ? copy.retainedUnknown : copy.retainedNote}</p>
      </div>

      {situation.notices.length > 0 && (
        <ul className="mt-3 space-y-2">
          {situation.notices.map((notice) => (
            <li key={notice.code} className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-ink">
              {notice.code === "insurer_says_paid"
                ? copy.notices.insurer_says_paid(money(notice.claimed), money(notice.received))
                : notice.code === "expected_not_recorded"
                  ? copy.notices.expected_not_recorded(money(notice.claimed))
                  : notice.code === "payout_without_receipt"
                    ? copy.notices.payout_without_receipt(money(notice.paid))
                    : copy.notices.expected_without_due_date}
            </li>
          ))}
        </ul>
      )}

      <PolicyHistory history={situation.history} partyNames={situation.partyNames} />

      {canAct && situation.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {situation.actions.map((action) => (
            <Button key={action.objectId} size="sm" loading={opening === action.objectId} onClick={() => start(action)}>
              {action.kind === "receive" ? copy.receive : copy.pay}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}

/** REQ-276: the policy's story, oldest first, in plain sentences. */
function PolicyHistory({ history, partyNames }: { history: PolicyHistoryEntry[]; partyNames: Record<string, string> }) {
  const { language } = useLanguage();
  const copy = signalsCopy[language].situation;
  const money = (amount: string) => formatMoneyForLanguage(amount, "BRL", language);
  const name = (id: string | null) => (id === null ? copy.someone : partyNames[id] ?? id);
  const hasFacts = history.some((h) => h.kind !== "signal");

  const sentence = (entry: PolicyHistoryEntry): string => {
    switch (entry.kind) {
      case "signal":
        return copy.story.signal(copy.story.signalKinds[entry.signalKind], entry.recordedBy);
      case "expected":
        return copy.story.expected(money(entry.amount), name(entry.from));
      case "obligation":
        return copy.story.obligation(money(entry.amount), name(entry.to));
      case "received":
        return copy.story.received(money(entry.amount), name(entry.from));
      case "paid":
        return copy.story.paid(money(entry.amount), name(entry.to));
      default:
        return copy.story.other(money(entry.amount), entry.eventType);
    }
  };

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-sm font-semibold text-ink">{copy.historyTitle}</p>
      {!hasFacts && <p className="mt-1 text-xs text-muted">{copy.historyEmpty}</p>}
      <ol className="mt-2 space-y-1.5">
        {history.map((entry, i) => {
          const withdrawn = entry.kind !== "signal" && entry.retracted;
          return (
            <li key={i} className="flex gap-3 text-[13px]">
              <span className="tabular shrink-0 text-muted">{formatDateForLanguage(entry.at, language)}</span>
              <span className={entry.kind === "signal" ? "italic text-muted" : "text-ink"}>
                <span className={withdrawn ? "line-through" : undefined}>{sentence(entry)}</span>
                {entry.kind !== "signal" && entry.batchId && <span className="ml-1.5 text-xs text-muted">{copy.story.inBatch}</span>}
                {withdrawn && <span className="ml-1.5 text-xs font-medium text-warn">{copy.retracted}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted">{copy.historyNote}</p>
    </div>
  );
}

function Figures({ title, rows, empty }: { title: string; rows: [string, string][] | null; empty: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {rows === null ? (
        <p className="mt-1 text-xs text-muted">{empty}</p>
      ) : (
        <dl className="mt-1 space-y-0.5 text-[13px]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
