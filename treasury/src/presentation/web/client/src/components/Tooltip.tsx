import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a trigger that may itself be disabled (and therefore pointer-events-none): the
 * hover/focus listeners live on this wrapper, not on the child, so a disabled button
 * still reveals its tooltip.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span
      tabIndex={0}
      aria-label={content}
      className={cn("group relative inline-flex outline-none", className)}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-max max-w-[240px]",
          "rounded-xl border border-line bg-panel-solid px-3 py-2 text-[12px] text-ink shadow-lg",
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          "dark:border-white/10",
        )}
      >
        {content}
      </span>
    </span>
  );
}
