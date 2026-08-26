import { Badge } from "@/components/Badge";
import { GaugeArc } from "@/screens-concept/GaugeArc";
import { healthScoreFillFraction, healthScoreZone, type GaugeZone } from "@/screens-concept/financialHealthEngine";
import { useLanguage } from "@/i18n/i18n";

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
 * The book's composite health score (0–100) on the same single-color arc as `CashGauge`, sharing
 * `GaugeArc` so both dials read as one family rather than two different widgets bolted together.
 */
export function HealthScoreGauge({ score, title, maxWidth }: { score: number; title: string; maxWidth?: number }) {
  const { t } = useLanguage();
  const zone = healthScoreZone(score);
  const fraction = healthScoreFillFraction(score);
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
        ariaLabel={`${title}: ${Math.round(score)} — ${zoneLabel[zone]}`}
      />

      <div className="-mt-10 flex flex-col items-center gap-2 text-center">
        <p className="tabular font-display text-[36px] font-bold text-ink">
          {Math.round(score)}
          <span className="text-[16px] font-semibold text-muted">/100</span>
        </p>
        <p className="text-[13px] text-muted">{t.financialHealth.gauge.scoreSubtitle}</p>
        <Badge variant={zoneBadgeVariant[zone]} dot className="mt-1">
          {zoneLabel[zone]}
        </Badge>
      </div>
    </div>
  );
}
