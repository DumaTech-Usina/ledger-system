const CENTER_X = 120;
const CENTER_Y = 116;
const RADIUS = 92;
const TRACK_WIDTH = 16;
/** Half the circle's circumference — the full length of the 180° track, and what `strokeDasharray`
 * needs so `strokeDashoffset` can reveal exactly `fraction` of it as the progress fill. */
const ARC_LENGTH = Math.PI * RADIUS;

// Half-circle track path — the top half only, left to right, so the offset math below always
// reveals the fill starting from the left (the dial's low end), same reading direction as a value
// growing left→right.
const TRACK_PATH = `M ${CENTER_X - RADIUS} ${CENTER_Y} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER_X + RADIUS} ${CENTER_Y}`;

/**
 * The shared "velocímetro" arc behind both gauges on the Saúde Financeira screen (net cash, book
 * health score): a light track for the full 180° dial, and one glowing fill up to `fraction`. Pulled
 * out of `CashGauge` so the two gauges draw from one piece of geometry/glow code instead of two
 * copies drifting apart.
 */
export function GaugeArc({ fraction, color, ariaLabel, maxWidth = 460 }: { fraction: number; color: string; ariaLabel: string; maxWidth?: number }) {
  return (
    <svg
      viewBox="0 0 240 128"
      className="relative w-full overflow-visible"
      style={{ maxWidth }}
      role="img"
      aria-label={ariaLabel}
    >
      <path d={TRACK_PATH} fill="none" stroke="var(--color-line)" strokeWidth={TRACK_WIDTH} strokeLinecap="round" />
      {/* The glow lives only here, on the filled stroke itself — `drop-shadow` glows exactly the
          rendered (dashoffset-revealed) segment of the path, so it grows and shrinks with the fill
          and never bleeds onto the empty track or the card around it. `overflow-visible` on the svg
          keeps the browser from hard-clipping that glow at the viewBox edge; a single small blur
          keeps it a soft halo instead of a wide bloom. */}
      <path
        d={TRACK_PATH}
        fill="none"
        stroke={color}
        strokeWidth={TRACK_WIDTH}
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={ARC_LENGTH * (1 - fraction)}
        className="transition-[stroke-dashoffset,stroke] duration-700 ease-out motion-reduce:transition-none"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
