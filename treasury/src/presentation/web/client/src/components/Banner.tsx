import { type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type Variant = "ok" | "bad";

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  variant: Variant;
}

const variantClasses: Record<Variant, string> = {
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
};

export function Banner({ variant, className, children, ...props }: BannerProps) {
  return (
    <div
      role="status"
      className={cn("rounded-2xl px-4 py-3 text-sm font-semibold", variantClasses[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
