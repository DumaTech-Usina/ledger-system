import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

/**
 * A live-typing text filter, styled as the same rounded-full pill every other filter trigger in the
 * app uses (`DateRangePicker`, `Select`, `MultiSelectDropdown`) — a plain boxy `Input` reads as an
 * unrelated form field dropped into a filter row, not as one of the filters. The leading icon is
 * what marks it as search rather than a value to type in; there is nothing to click open here, so it
 * commits on every keystroke instead of being a popover trigger like its siblings.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ label, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 size-4 text-muted"
            strokeWidth={1.6}
          />
          <input
            ref={ref}
            id={inputId}
            type="text"
            className={cn(
              "h-10 w-full rounded-full border border-line bg-ink/[0.03] pl-10 pr-4 text-[13px] font-medium text-ink placeholder:font-normal placeholder:text-muted/70 dark:bg-white/5",
              "outline-none transition hover:bg-ink/6 focus:border-accent focus:ring-2 focus:ring-accent-soft dark:hover:bg-white/8",
            )}
            {...props}
          />
        </div>
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";
