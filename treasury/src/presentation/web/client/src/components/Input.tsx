import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 rounded-2xl border border-line bg-ink/[0.03] px-3 text-sm text-ink placeholder:text-muted/70 dark:bg-white/5",
            "outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft",
            error && "border-bad focus:border-bad focus:ring-bad-soft",
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error && <span className="text-xs font-medium text-bad">{error}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";
