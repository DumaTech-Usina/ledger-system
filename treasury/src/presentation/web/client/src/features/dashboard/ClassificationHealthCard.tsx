import { Card } from "@/components/Card";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import type { ClassificationHealth } from "@/types/dashboard";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex h-full flex-col justify-center">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold text-ink">{value}</p>
    </Card>
  );
}

export function ClassificationHealthCard({ health }: { health: ClassificationHealth }) {
  const { t } = useLanguage();
  const c = t.dashboard.classificationHealth;
  const oldest = health.oldestDays === null ? "—" : formatTemplate(c.oldestDays, { days: health.oldestDays });

  return (
    <section className="flex h-full flex-col">
      <h3 className="mb-3 font-display text-[15px] font-semibold text-ink">{c.title}</h3>
      <div className="grid flex-1 grid-cols-1 grid-rows-3 gap-4">
        <Stat label={c.uncategorized} value={String(health.uncategorizedCount)} />
        <Stat label={c.share} value={`${health.sharePercent}%`} />
        <Stat label={c.oldest} value={oldest} />
      </div>
    </section>
  );
}
