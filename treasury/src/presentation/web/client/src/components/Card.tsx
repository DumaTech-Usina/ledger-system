import { type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Reserved for the ledger lifecycle/confirmation moments — the design's one signature glow. */
  glow?: boolean;
  padding?: "none" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  md: "p-5",
  lg: "p-6",
};

export function Card({ glow, padding = "md", className, children, ...props }: CardProps) {
  return (
    <div className={cn("glass", glow && "glow-accent", paddingClasses[padding], className)} {...props}>
      {children}
    </div>
  );
}
