import { useState } from "react";
import { Card } from "@/components/Card";
import { languageOptions, useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = languageOptions.find((option) => option.code === language) ?? languageOptions[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.topbar.language}
        aria-expanded={open}
        title={t.topbar.language}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8",
          className,
        )}
      >
        <span aria-hidden className="text-base leading-none">
          {current.flag}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <Card
            padding="none"
            className="absolute right-0 top-11 z-40 w-44 border-white/15 bg-panel-solid p-1.5 shadow-xl dark:border-white/10"
          >
            {languageOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  setLanguage(option.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition",
                  option.code === language
                    ? "bg-accent-soft text-accent"
                    : "text-ink hover:bg-ink/6 dark:hover:bg-white/8",
                )}
              >
                <span aria-hidden className="text-base leading-none">
                  {option.flag}
                </span>
                {option.name}
              </button>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
