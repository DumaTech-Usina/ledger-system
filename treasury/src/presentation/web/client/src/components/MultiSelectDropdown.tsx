import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface MultiSelectDropdownOption {
  value: string;
  label: string;
}

function ChevronDownIcon() {
  return <ChevronDown className="size-3.5" strokeWidth={1.6} />;
}

function CheckIcon() {
  return <Check className="size-3" strokeWidth={2} />;
}

/**
 * A closed set, chosen from a single dropdown — the same glass-popover trigger every selection
 * control in the app uses (see {@link Select} for the single-value case). Every filter reads as one
 * field with a count, never a row of standalone toggle buttons competing for attention.
 *
 * Each row commits immediately on click; there is no separate Apply, since toggling a checkbox is
 * already the whole action.
 */
export function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selected,
  onChange,
  selectedLabel,
  className,
}: {
  label?: string;
  placeholder: string;
  options: MultiSelectDropdownOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Renders the trigger's text for a non-empty selection, e.g. "{count} selecionados". */
  selectedLabel: (count: number) => string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label && (
        <span id={id} className="text-[13px] font-semibold text-muted">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-labelledby={label ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center justify-between gap-2 rounded-2xl border border-line bg-ink/[0.03] px-3 text-sm dark:bg-white/5",
          "outline-none transition hover:bg-ink/6 focus:border-accent focus:ring-2 focus:ring-accent-soft dark:hover:bg-white/8",
        )}
      >
        <span className={selected.length === 0 ? "text-muted" : "text-ink"}>
          {selected.length === 0 ? placeholder : selectedLabel(selected.length)}
        </span>
        <span className={cn("text-muted transition-transform", open && "rotate-180")}>
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="glass-popover motion-safe:animate-[glass-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both] absolute top-full left-0 z-50 mt-2 max-h-72 w-56 overflow-y-auto p-2">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink transition hover:bg-ink/6 dark:hover:bg-white/8"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition",
                    checked ? "border-accent bg-accent text-accent-ink" : "border-line text-transparent",
                  )}
                >
                  <CheckIcon />
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
