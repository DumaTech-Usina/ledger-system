import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "ghost" | "danger" | "warn";
type Size = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-accent)_100%,white_10%),var(--color-accent))] text-accent-ink shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_var(--color-accent)] hover:brightness-110 active:brightness-95",
  ghost:
    "bg-ink/5 text-ink hover:bg-ink/10 dark:bg-white/8 dark:hover:bg-white/12",
  danger: "bg-bad text-white hover:brightness-110 active:brightness-95",
  /** Soft amber/orange accent — for secondary actions that change something, like "Editar". */
  warn: "bg-warn-soft text-warn hover:brightness-105 active:brightness-95",
};

const sizeClasses: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-[13px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-medium",
          "transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
