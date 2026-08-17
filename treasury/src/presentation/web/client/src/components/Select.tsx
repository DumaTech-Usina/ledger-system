import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function ChevronDownIcon() {
  return <ChevronDown className="size-3.5" strokeWidth={1.6} />;
}

function CheckIcon() {
  return <Check className="size-3" strokeWidth={2} />;
}

/**
 * One choice from a closed set, picked from the same glass-popover dropdown every other selection
 * control in the app uses (see {@link MultiSelectDropdown}) — a native `<select>` renders with the
 * browser's own chrome, which is exactly the inconsistency this replaces. Picking an option commits
 * and closes immediately; there is nothing to apply separately, unlike a date or a multi-value filter.
 */
export function Select({ label, options, value, onChange, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

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
          "flex h-10 items-center justify-between gap-2 rounded-2xl border border-line bg-ink/[0.03] px-3 text-sm text-ink dark:bg-white/5",
          "outline-none transition hover:bg-ink/6 focus:border-accent focus:ring-2 focus:ring-accent-soft dark:hover:bg-white/8",
        )}
      >
        <span>{current?.label ?? value}</span>
        <span className={cn("text-muted transition-transform", open && "rotate-180")}>
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="glass-popover motion-safe:animate-[glass-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both] absolute top-full left-0 z-50 mt-2 max-h-72 w-full min-w-max overflow-y-auto p-2">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] whitespace-nowrap text-ink transition hover:bg-ink/6 dark:hover:bg-white/8"
              >
                <span className={cn("flex size-4 shrink-0 items-center justify-center", selected ? "text-accent" : "text-transparent")}>
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
