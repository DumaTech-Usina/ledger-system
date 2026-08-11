import type { OpenBalanceByObjectType } from "@/types/dashboard";
import { compositionState } from "@/features/dashboard/compositionEngine";
import { useLanguage } from "@/i18n/i18n";
import { formatMoney } from "@/utils/format";

/**
 * What a total is made of, by kind of object.
 *
 * Every number here is the Ledger's own: the lines are the rows its totals are folded over, and it
 * publishes them already ordered by weight. Nothing is summed, ranked or converted on this side —
 * the order arrives with the data and the amounts are only formatted.
 *
 * A kind the vocabulary does not know keeps its raw value on screen, the same fallback every other
 * published term gets here. An invented label would be a claim the app cannot support.
 */
export function CompositionList({
  lines,
  currency,
}: {
  lines: OpenBalanceByObjectType[] | undefined;
  currency: string;
}) {
  const { t } = useLanguage();
  const state = compositionState(lines);

  if (state !== "listed") {
    return (
      <p className="px-1 py-3 text-sm text-muted">
        {state === "unknown" ? t.positions.compositionUnknown : t.positions.compositionEmpty}
      </p>
    );
  }

  return (
    <dl className="divide-y divide-line">
      {lines!.map((line) => (
        <div key={line.objectType} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="min-w-0 text-sm text-ink">
            {t.objectType[line.objectType] ?? line.objectType}
          </dt>
          <dd className="tabular shrink-0 text-sm font-semibold text-ink">
            {formatMoney(line.openBalance, currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
