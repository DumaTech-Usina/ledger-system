import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  /** Hint for the filter box a long list gets. */
  searchPlaceholder?: string;
}

/** A list longer than this gets a filter box: past it, finding a name by scrolling stops being easy. */
const SEARCH_FROM = 7;
const LIST_MAX_HEIGHT = 288;
const LIST_GAP = 8;
/** Above Modal's z-[100], since a Select can sit inside one. */
const LIST_Z_INDEX = 110;

const folded = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const matches = (label: string, query: string) => folded(label).includes(folded(query.trim()));

/** Opens downward, unless only the space above the button fits the list. */
function placementBelowOrAbove(button: DOMRect): CSSProperties {
  const below = window.innerHeight - button.bottom;
  const opensUp = below < LIST_MAX_HEIGHT + LIST_GAP && button.top > below;
  return {
    position: "fixed",
    left: button.left,
    minWidth: button.width,
    zIndex: LIST_Z_INDEX,
    ...(opensUp ? { bottom: window.innerHeight - button.top + LIST_GAP } : { top: button.bottom + LIST_GAP }),
  };
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
export function Select({ label, options, value, onChange, className, searchPlaceholder }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placement, setPlacement] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);
  const searchable = options.length > SEARCH_FROM;
  const visible = query.trim() === "" ? options : options.filter((o) => matches(o.label, query));

  const toggle = () => {
    if (!open) {
      setPlacement(placementBelowOrAbove(buttonRef.current!.getBoundingClientRect()));
      setQuery("");
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    // The list is pinned to where the button was; once the page moves, that place is wrong.
    const onViewportChange = (event: Event) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
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
        ref={buttonRef}
        type="button"
        aria-labelledby={label ? id : undefined}
        aria-expanded={open}
        onClick={toggle}
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

      {/* Rendered on <body>: a card's backdrop-filter makes it a stacking context, so a list drawn
          inside one stays beneath the next card no matter its z-index. */}
      {open && createPortal(
        <div
          ref={popoverRef}
          style={placement}
          className="glass-popover motion-safe:animate-[glass-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both] max-h-72 overflow-y-auto p-2"
        >
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder ?? label}
              className="mb-1 h-9 w-full rounded-xl border border-line bg-transparent px-2.5 text-[13px] text-ink outline-none focus:border-accent"
            />
          )}
          {visible.map((option) => {
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
        </div>,
        document.body,
      )}
    </div>
  );
}
