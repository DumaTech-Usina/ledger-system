import { type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type Variant = "neutral" | "ok" | "bad" | "warn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  /** Leading status dot; pass `pulse` to animate it (the active lifecycle step). */
  dot?: boolean | "pulse";
}

const variantClasses: Record<Variant, string> = {
  neutral: "bg-ink/6 text-muted dark:bg-white/8",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
};

const dotClasses: Record<Variant, string> = {
  neutral: "bg-muted",
  ok: "bg-ok",
  bad: "bg-bad",
  warn: "bg-warn",
};

export function Badge({ variant = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", dotClasses[variant], dot === "pulse" && "animate-[pulse-dot_1.8s_ease-in-out_infinite]")}
        />
      )}
      {children}
    </span>
  );
}
