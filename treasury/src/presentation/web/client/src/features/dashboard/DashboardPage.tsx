import { Card } from "@/components/Card";
import { ClassificationHealthCard } from "@/features/dashboard/ClassificationHealthCard";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { PositionsTable } from "@/features/dashboard/PositionsTable";
import { useDashboard } from "@/features/dashboard/useDashboard";
import { formatDate, formatMoney } from "@/utils/format";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <Card>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={`tabular mt-1.5 text-2xl font-semibold ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-ink"}`}>
        {value}
      </p>
    </Card>
  );
}

export function DashboardPage() {
  const { data, loading } = useDashboard();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Verdade financeira</h2>
        <p className="mt-1 text-sm text-muted">
          Visões somente leitura obtidas do Ledger. Posição de caixa, extratos e projeções.
        </p>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-muted">Carregando…</p>
        </Card>
      ) : !data?.available || !data.cashPosition ? (
        <Card>
          <p className="text-sm text-muted">Não foi possível carregar os dados do Ledger no momento.</p>
        </Card>
      ) : (
        <>
          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Entradas de caixa" value={formatMoney(data.cashPosition.totalCashIn, data.cashPosition.currency)} />
              <Stat label="Saídas de caixa" value={formatMoney(data.cashPosition.totalCashOut, data.cashPosition.currency)} />
              <Stat
                label="Fluxo líquido"
                value={formatMoney(data.cashPosition.netCashFlow, data.cashPosition.currency)}
                tone={data.cashPosition.netCashFlow.startsWith("-") ? "bad" : "ok"}
              />
              <Stat label="A receber em aberto" value={formatMoney(data.cashPosition.openReceivables, data.cashPosition.currency)} />
            </div>
            <p className="mt-3 text-[13px] text-muted">Posição em {formatDate(data.cashPosition.asOf)}</p>
          </section>

          {data.classificationHealth && <ClassificationHealthCard health={data.classificationHealth} />}

          <section>
            <h3 className="mb-3 font-display text-[15px] font-semibold text-ink">Movimentações recentes</h3>
            <Card padding="none">
              <MovementsTable movements={data.movements ?? []} currency={data.cashPosition.currency} />
            </Card>
          </section>

          <section>
            <h3 className="mb-3 font-display text-[15px] font-semibold text-ink">Posições em aberto</h3>
            <Card padding="none">
              <PositionsTable positions={data.positions ?? []} currency={data.cashPosition.currency} />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
