import { TriangleAlert } from "lucide-react";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { pendingSummary } from "@/features/parties/partiesEngine";
import type { PendingIdentity } from "@/features/parties/partiesApi";
import { useLanguage } from "@/i18n/i18n";

/**
 * The persistent notification (REQ-321): on every page, for every user, until each identity is
 * resolved. There is deliberately no close button. Whether it grows more insistent, or blocks
 * anything, is still DEC-016; today it only insists.
 */
export function PendingIdentitiesBanner({
  pending,
  onResolve,
}: {
  pending: PendingIdentity[];
  /** Absent for someone without curation: they see it, and only a curator can act on it. */
  onResolve?: () => void;
}) {
  const { language } = useLanguage();
  const copy = partiesCopy[language];
  const summary = pendingSummary(pending);
  if (!summary) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-bad/30 bg-bad-soft px-4 py-2.5 text-sm font-semibold text-bad md:px-6"
    >
      <TriangleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
      <span className="flex-1">{copy.pending(summary.count, summary.names)}</span>
      {onResolve && (
        <button
          type="button"
          onClick={onResolve}
          className="rounded-full border border-bad/50 px-3 py-1 text-xs font-semibold transition hover:bg-bad hover:text-white"
        >
          {copy.resolve}
        </button>
      )}
    </div>
  );
}
