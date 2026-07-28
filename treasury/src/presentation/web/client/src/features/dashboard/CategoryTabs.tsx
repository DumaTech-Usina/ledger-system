import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import type { MovementCategory } from "@/types/dashboard";

export type CategoryKey = "todos" | MovementCategory;

export function CategoryTabs({ active, onChange }: { active: CategoryKey; onChange: (key: CategoryKey) => void }) {
  const { t } = useLanguage();
  const tabs: { key: CategoryKey; label: string; disabled?: boolean }[] = [
    { key: "todos", label: t.dashboard.categories.all },
    { key: "saude", label: t.dashboard.categories.health },
    { key: "consorcio", label: t.dashboard.categories.consortium, disabled: true },
    { key: "seguro", label: t.dashboard.categories.insurance, disabled: true },
    { key: "outros", label: t.dashboard.categories.others, disabled: true },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          disabled={tab.disabled}
          title={tab.disabled ? t.dashboard.categories.comingSoon : undefined}
          onClick={() => !tab.disabled && onChange(tab.key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition",
            tab.disabled
              ? "cursor-not-allowed text-muted/60"
              : active === tab.key
                ? "bg-accent text-accent-ink"
                : "bg-ink/5 text-ink hover:bg-ink/10 dark:bg-white/8 dark:hover:bg-white/12",
          )}
        >
          {tab.label}
          {tab.disabled && (
            <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
              <rect x="5" y="9" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
