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
