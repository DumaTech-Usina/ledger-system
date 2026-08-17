import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTemplate, useLanguage } from "@/i18n/i18n";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const { t } = useLanguage();
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-ink/6 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/8"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        {t.common.previous}
      </button>
      <p className="text-[12.5px] text-muted">{formatTemplate(t.common.pageOf, { page, total: totalPages })}</p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-ink/6 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/8"
      >
        {t.common.next}
        <ChevronRight className="size-3.5" strokeWidth={1.6} />
      </button>
    </div>
  );
}
