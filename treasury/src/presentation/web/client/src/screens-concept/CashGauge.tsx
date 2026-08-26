import { Badge } from "@/components/Badge";
import { GaugeArc } from "@/screens-concept/GaugeArc";
import { cashGaugeFillFraction, cashGaugeZone, type GaugeZone } from "@/screens-concept/financialHealthEngine";
import { useLanguage } from "@/i18n/i18n";
import { formatMoney } from "@/utils/format";

/** Never color alone: the zone is also spelled out in words via `Badge`, per this app's status-color
 * convention and this project's dataviz guidance. */
const zoneBadgeVariant: Record<GaugeZone, "bad" | "warn" | "ok"> = {
  red: "bad",
  yellow: "warn",
  green: "ok",
};

const zoneColor: Record<GaugeZone, string> = {
  red: "var(--color-bad)",
  yellow: "var(--color-warn)",
  green: "var(--color-ok)",
};

/**
 * The net-cash "velocímetro" — a single-color progress arc (no fixed red/yellow/green bands): a
 * light track for the full 180° dial, and one glowing fill from the left up to the current net-cash
 * reading. The fill's color still follows the zone (see `financialHealthEngine.ts`), so the dial
 * stays a status read at a glance, but only ever shows the ONE color that applies right now — the
 * way the rest of this design system uses color (a single accent, never several competing hues on
 * one shape).
 */
export function CashGauge({ netCashFlow, currency, title, maxWidth }: { netCashFlow: number; currency: string; title: string; maxWidth?: number }) {
  const { t } = useLanguage();
  const zone = cashGaugeZone(netCashFlow);
  const fraction = cashGaugeFillFraction(netCashFlow);
  const color = zoneColor[zone];

  const zoneLabel: Record<GaugeZone, string> = {
    red: t.financialHealth.gauge.zoneCritical,
    yellow: t.financialHealth.gauge.zoneCaution,
    green: t.financialHealth.gauge.zoneHealthy,
  };

  return (
    <div className="relative flex flex-col items-center gap-4">
      <p className="w-full text-center text-[13px] font-semibold text-muted">{title}</p>
      <GaugeArc
        fraction={fraction}
        color={color}
        maxWidth={maxWidth}
        ariaLabel={`${title}: ${formatMoney(String(netCashFlow), currency)} — ${zoneLabel[zone]}`}
      />

      <div className="-mt-10 flex flex-col items-center gap-2 text-center">
        <p className="tabular font-display text-[36px] font-bold text-ink">{formatMoney(String(netCashFlow), currency)}</p>
        <p className="text-[13px] text-muted">{t.financialHealth.gauge.subtitle}</p>
        <Badge variant={zoneBadgeVariant[zone]} dot className="mt-1">
          {zoneLabel[zone]}
        </Badge>
      </div>
    </div>
  );
}
