/**
 * Light theme's signature inside the chat only — three soft bands rippling like aurora-borealis
 * curtains, anchored around the composer at the bottom (never behind the messages/header).
 * Dark theme keeps the mp4 loop instead (see OperationsShell), so this stays `dark:hidden`.
 * Drift pauses under `prefers-reduced-motion`.
 */
export function ChatAurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 h-64 w-full overflow-hidden [mask-image:linear-gradient(to_top,black_70%,transparent)] dark:hidden md:h-72"
    >
      <span
        className="absolute -left-1/4 top-[15%] h-40 w-[150%] rounded-[50%] bg-accent/25 blur-3xl motion-safe:animate-[aurora-wave-1_18s_ease-in-out_infinite]"
        aria-hidden
      />
      <span
        className="absolute -left-1/3 top-[45%] h-36 w-[160%] rounded-[50%] bg-secondary/20 blur-3xl motion-safe:animate-[aurora-wave-2_22s_ease-in-out_infinite]"
        aria-hidden
      />
      <span
        className="absolute -left-1/4 top-[70%] h-44 w-[150%] rounded-[50%] bg-ok/20 blur-3xl motion-safe:animate-[aurora-wave-3_26s_ease-in-out_infinite]"
        aria-hidden
      />
    </div>
  );
}
