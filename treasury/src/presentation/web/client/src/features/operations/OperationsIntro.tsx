import { cn } from "@/utils/cn";

export type GreetingPhase = "hidden" | "in" | "out";

export interface OperationsIntroProps {
  firstName: string;
  phase: GreetingPhase;
}

/** Purely presentational — OperationsPage owns the timing so there's a single source of truth. */
export function OperationsIntro({ firstName, phase }: OperationsIntroProps) {
  if (phase === "hidden") return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 text-center">
      <h2
        className={cn(
          "font-display text-2xl font-semibold text-ink md:text-3xl",
          phase === "in" && "animate-[intro-reveal-slow_1s_ease-out_forwards]",
          phase === "out" && "animate-[intro-hide-slow_0.5s_ease-in_forwards]",
        )}
      >
        Olá, {firstName}
      </h2>
    </div>
  );
}
