import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { ClassificationHealth } from "@/types/dashboard";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold text-ink">{value}</p>
    </Card>
  );
}

export function ClassificationHealthCard({ health }: { health: ClassificationHealth }) {
  const oldest = health.oldestDays === null ? "—" : `${health.oldestDays} dias`;

  return (
    <section>
      <h3 className="mb-3 font-display text-[15px] font-semibold text-ink">Saúde de classificação</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Pagamentos sem categoria" value={String(health.uncategorizedCount)} />
        <Stat label="Participação" value={`${health.sharePercent}%`} />
        <Stat label="Mais antigo" value={oldest} />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">≤ 30 dias: {health.aging.fresh}</Badge>
          <Badge variant="neutral">31–90 dias: {health.aging.recent}</Badge>
          <Badge variant={health.aging.stale > 0 ? "bad" : "neutral"}>&gt; 90 dias: {health.aging.stale}</Badge>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Saídas registradas sem uma categoria específica. Promova-as a uma operação dedicada (ex.: Folha de
          pagamento) para reduzir este número.
        </p>
      </Card>
    </section>
  );
}
