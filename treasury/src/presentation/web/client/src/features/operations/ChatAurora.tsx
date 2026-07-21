/**
 * Light theme's signature inside the chat only — three soft bands rippling like aurora-borealis
 * curtains. Dark theme keeps the mp4 loop instead (see OperationsShell), so this stays `dark:hidden`.
 * Drift pauses under `prefers-reduced-motion`.
 */
export function ChatAurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden dark:hidden">
      <span
        className="absolute -left-1/4 top-[8%] h-40 w-[150%] rounded-[50%] bg-accent/25 blur-3xl motion-safe:animate-[aurora-wave-1_18s_ease-in-out_infinite]"
        aria-hidden
      />
      <span
        className="absolute -left-1/3 top-[38%] h-36 w-[160%] rounded-[50%] bg-secondary/20 blur-3xl motion-safe:animate-[aurora-wave-2_22s_ease-in-out_infinite]"
        aria-hidden
      />
      <span
        className="absolute -left-1/4 top-[66%] h-44 w-[150%] rounded-[50%] bg-ok/20 blur-3xl motion-safe:animate-[aurora-wave-3_26s_ease-in-out_infinite]"
        aria-hidden
      />
    </div>
  );
}
