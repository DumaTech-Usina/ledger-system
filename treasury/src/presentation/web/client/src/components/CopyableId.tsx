import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";

/**
 * An identifier, readable and takeable.
 *
 * An audit starts from an id, so ids are shown rather than hidden — but a full id is long enough to
 * crowd out the meaning around it, so it truncates where the screen is narrow and is always copied
 * WHOLE. What is on screen may be an abbreviation; what reaches the clipboard never is.
 */
export function CopyableId({
  value,
  className,
  /** Widths the id truncates to before the screen is wide enough to show it in full. */
  widths = "max-w-[9ch] sm:max-w-[16ch] lg:max-w-none",
}: {
  value: string;
  className?: string;
  widths?: string;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // No clipboard permission (or no secure context): the id stays on screen to be selected by
      // hand. Nothing is lost, so nothing is claimed — the button simply does not confirm.
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span title={value} className={cn("tabular block truncate text-[12.5px] text-muted", widths)}>
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t.common.copied : t.common.copyId}
        title={copied ? t.common.copied : t.common.copyId}
        className={cn(
          "inline-flex size-6 flex-shrink-0 items-center justify-center rounded-full transition",
          "hover:bg-ink/8 hover:text-ink dark:hover:bg-white/10",
          copied ? "text-ok" : "text-muted",
        )}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      {/* Confirmation for anyone not watching the icon change. */}
      <span aria-live="polite" className="sr-only">
        {copied ? t.common.copied : ""}
      </span>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
      <rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M13 5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
      <path
        d="m4.5 10.5 3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
