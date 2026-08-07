/**
 * Rounded tick values covering [min, max] on a 1 / 2 / 2.5 / 5 / 10 step. Zero is always inside the
 * domain — a flow axis is read against it, so it can never fall off the chart.
 */
export function niceTicks(min: number, max: number, target = 4): { ticks: number[]; lo: number; hi: number } {
  const spanLo = Math.min(0, min);
  const spanHi = Math.max(0, max);
  const span = spanHi - spanLo || 1;
  const raw = span / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const lo = Math.floor(spanLo / step) * step;
  const hi = Math.ceil(spanHi / step) * step;
  const ticks: number[] = [];
  for (let value = lo; value <= hi + step / 2; value += step) {
    ticks.push(Math.abs(value) < step / 1e6 ? 0 : value);
  }
  return { ticks, lo, hi };
}

/** SVG path for a bar growing from a square baseline to a 4px-rounded tip (up or down). */
export function verticalBarPath(x: number, width: number, yBase: number, yTip: number, radius = 4): string {
  const r = Math.min(radius, Math.abs(yTip - yBase) / 2, width / 2);
  if (r <= 0.5) {
    const top = Math.min(yBase, yTip);
    const bottom = Math.max(yBase, yTip);
    return `M ${x} ${top} H ${x + width} V ${bottom} H ${x} Z`;
  }
  if (yTip <= yBase) {
    return `M ${x} ${yBase} L ${x} ${yTip + r} Q ${x} ${yTip} ${x + r} ${yTip} L ${x + width - r} ${yTip} Q ${x + width} ${yTip} ${x + width} ${yTip + r} L ${x + width} ${yBase} Z`;
  }
  return `M ${x} ${yBase} L ${x} ${yTip - r} Q ${x} ${yTip} ${x + r} ${yTip} L ${x + width - r} ${yTip} Q ${x + width} ${yTip} ${x + width} ${yTip - r} L ${x + width} ${yBase} Z`;
}
