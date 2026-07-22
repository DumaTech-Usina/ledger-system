import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { useLanguage } from "@/i18n/i18n";
import type { ClassificationHealth } from "@/types/dashboard";

export function ClassificationAgingCard({ health }: { health: ClassificationHealth }) {
  const { t } = useLanguage();
  const c = t.dashboard.classificationHealth;

  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {c.fresh}: {health.aging.fresh}
        </Badge>
        <Badge variant="neutral">
          {c.recent}: {health.aging.recent}
        </Badge>
        <Badge variant={health.aging.stale > 0 ? "bad" : "neutral"}>
          {c.stale}: {health.aging.stale}
        </Badge>
      </div>
      <p className="mt-3 text-[13px] text-muted">{c.note}</p>
    </Card>
  );
}
