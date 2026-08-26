import { describe, it, expect } from "vitest";
import {
  CASH_GAUGE_GREEN_FLOOR,
  CASH_GAUGE_MAX,
  CASH_GAUGE_MIN,
  cashGaugeFillFraction,
  cashGaugeZone,
  computeInsights,
  healthScoreFillFraction,
  healthScoreZone,
  type ComputeInsightsInput,
} from "@/screens-concept/financialHealthEngine";

describe("cashGaugeZone", () => {
  it("is red below zero", () => {
    expect(cashGaugeZone(-1)).toBe("red");
    expect(cashGaugeZone(-50_000)).toBe("red");
  });

  it("is yellow from zero up to (not including) the green floor", () => {
    expect(cashGaugeZone(0)).toBe("yellow");
    expect(cashGaugeZone(49_999)).toBe("yellow");
  });

  it("is green at and above the user's own anchor — 50 mil", () => {
    expect(cashGaugeZone(CASH_GAUGE_GREEN_FLOOR)).toBe("green");
    expect(cashGaugeZone(200_000)).toBe("green");
  });
});

describe("cashGaugeFillFraction", () => {
  it("is 0 at the domain minimum and 1 at the maximum", () => {
    expect(cashGaugeFillFraction(CASH_GAUGE_MIN)).toBe(0);
    expect(cashGaugeFillFraction(CASH_GAUGE_MAX)).toBe(1);
  });

  it("is 0.5 at the domain midpoint", () => {
    const mid = (CASH_GAUGE_MIN + CASH_GAUGE_MAX) / 2;
    expect(cashGaugeFillFraction(mid)).toBe(0.5);
  });

  it("clamps to the nearest end for a value outside the domain, rather than reading past 0/1", () => {
    expect(cashGaugeFillFraction(CASH_GAUGE_MIN - 1_000_000)).toBe(0);
    expect(cashGaugeFillFraction(CASH_GAUGE_MAX + 1_000_000)).toBe(1);
  });
});

describe("healthScoreZone", () => {
  it("is red under 40, yellow up to (not including) 70, green at and above 70", () => {
    expect(healthScoreZone(0)).toBe("red");
    expect(healthScoreZone(39)).toBe("red");
    expect(healthScoreZone(40)).toBe("yellow");
    expect(healthScoreZone(69)).toBe("yellow");
    expect(healthScoreZone(70)).toBe("green");
    expect(healthScoreZone(100)).toBe("green");
  });
});

describe("healthScoreFillFraction", () => {
  it("maps the 0-100 score directly onto a 0-1 fraction, clamped past either end", () => {
    expect(healthScoreFillFraction(0)).toBe(0);
    expect(healthScoreFillFraction(50)).toBe(0.5);
    expect(healthScoreFillFraction(100)).toBe(1);
    expect(healthScoreFillFraction(-10)).toBe(0);
    expect(healthScoreFillFraction(150)).toBe(1);
  });
});

const copy: ComputeInsightsInput["copy"] = {
  generalSpendingUp: "Aumento nos gastos gerais",
  generalSpendingDown: "Diminuição nos gastos gerais",
  generalRevenueUp: "Aumento na receita geral",
  generalRevenueDown: "Diminuição na receita",
  categorySpendingUp: (c) => `Aumento nos gastos com ${c}`,
  categoryRevenueUp: (c) => `Aumento na receita de ${c}`,
  loanRecoveryHigh: "Alta recuperação de empréstimos",
  advanceRecoveryHigh: "Alta recuperação de adiantamentos",
  commissionOpenExcess: "Excesso de expectativa de comissão em aberto",
  capitalAtRisk: "Capital em risco identificado",
  overduePayables: "Pagamentos vencidos em aberto",
  healthTrendUp: "Melhora na saúde financeira do livro",
  healthTrendDown: "Piora na saúde financeira do livro",
  vsLastPeriod: (pct) => `${pct} em relação ao período anterior`,
  shareOfReceivables: (pct) => `${pct} dos recebíveis em aberto`,
  pointsDelta: (delta) => `${delta} pontos`,
};

const factorLabels: ComputeInsightsInput["factorLabels"] = {
  previousPeriod: "Período anterior",
  currentPeriod: "Período atual",
  variation: "Variação",
  category: "Categoria",
  commissionOpen: "Comissão em aberto",
  totalOpenReceivables: "Total de recebíveis em aberto",
  share: "Participação",
  capitalAtRisk: "Capital em risco",
  openExposure: "Exposição em aberto",
  riskShare: "% da exposição em risco",
  overduePayable: "Vencido",
  upcomingPayable: "A vencer",
  undatedPayable: "Sem vencimento definido",
  healthScore: "Pontuação atual",
  closureQuality: "Qualidade de fechamento",
  openBookHealth: "Saúde do livro em aberto",
  windowDays: "Janela analisada",
};

const baseInput: ComputeInsightsInput = {
  currentPeriod: null,
  previousPeriod: null,
  healthTrend: null,
  labelFor: (key) => key,
  copy,
  factorLabels,
  formatAmount: (a) => `R$ ${a}`,
};

describe("computeInsights", () => {
  it("reports nothing when there is no data at all — silence, never a guess", () => {
    expect(computeInsights(baseInput)).toEqual([]);
  });

  it("flags a significant rise in total spending, but not a small wobble — with the % as the detail", () => {
    const risen = computeInsights({
      ...baseInput,
      previousPeriod: { cashOut: "1000" },
      currentPeriod: { cashOut: "1200" }, // +20%
    });
    const spendingUp = risen.find((i) => i.id === "spending-up");
    expect(spendingUp?.detail).toBe("+20% em relação ao período anterior");

    const stable = computeInsights({
      ...baseInput,
      previousPeriod: { cashOut: "1000" },
      currentPeriod: { cashOut: "1030" }, // +3%
    });
    expect(stable.map((i) => i.id)).not.toContain("spending-up");
  });

  it("flags a drop in revenue as bad news, a rise as good news", () => {
    const dropped = computeInsights({
      ...baseInput,
      previousPeriod: { cashIn: "2000" },
      currentPeriod: { cashIn: "1500" }, // -25%
    });
    expect(dropped[0]).toMatchObject({ id: "revenue-down", tone: "bad", detail: "-25% em relação ao período anterior" });

    const rose = computeInsights({
      ...baseInput,
      previousPeriod: { cashIn: "2000" },
      currentPeriod: { cashIn: "3000" }, // +50%
    });
    expect(rose[0]).toMatchObject({ id: "revenue-up", tone: "ok" });
  });

  it("names the single category that grew the most, ignoring ones too small to matter", () => {
    const result = computeInsights({
      ...baseInput,
      previousPeriod: { cashOutByType: { payroll_payment: "10000", tax_payment: "100" } },
      currentPeriod: { cashOutByType: { payroll_payment: "13000", tax_payment: "300" } }, // +30% / +200%
      labelFor: (k) => (k === "payroll_payment" ? "Pagamento de folha" : k),
    });
    // tax_payment moved 200% but stayed under MIN_CATEGORY_AMOUNT — payroll wins on being real money.
    expect(result.some((i) => i.text === "Aumento nos gastos com Pagamento de folha")).toBe(true);
    expect(result.some((i) => i.text.includes("tax"))).toBe(false);
  });

  it("phrases a loan-repayment surge as recovery, not as generic revenue growth", () => {
    const result = computeInsights({
      ...baseInput,
      previousPeriod: { cashInByType: { loan_repayment: "5000" } },
      currentPeriod: { cashInByType: { loan_repayment: "8000" } },
    });
    expect(result.map((i) => i.id)).toContain("loan-recovery");
    expect(result.some((i) => i.text.includes("receita de"))).toBe(false);
  });

  it("flags commission concentration among open receivables past the share threshold, with the share as detail", () => {
    const concentrated = computeInsights({
      ...baseInput,
      openReceivablesByType: [
        { objectType: "commission_receivable", openBalance: "6000" },
        { objectType: "receivable", openBalance: "4000" },
      ],
    });
    expect(concentrated.find((i) => i.id === "commission-open-excess")?.detail).toBe("+60% dos recebíveis em aberto");

    const notConcentrated = computeInsights({
      ...baseInput,
      openReceivablesByType: [
        { objectType: "commission_receivable", openBalance: "1000" },
        { objectType: "receivable", openBalance: "9000" },
      ],
    });
    expect(notConcentrated.map((i) => i.id)).not.toContain("commission-open-excess");
  });

  it("surfaces capital at risk and overdue payables as current-state facts, with the amount as the detail", () => {
    const result = computeInsights({ ...baseInput, capitalAtRisk: "1500.00", overduePayable: "300.00" });
    expect(result.find((i) => i.id === "capital-at-risk")).toMatchObject({
      text: "Capital em risco identificado",
      detail: "R$ 1500.00",
    });
    expect(result.find((i) => i.id === "overdue-payables")).toMatchObject({
      text: "Pagamentos vencidos em aberto",
      detail: "R$ 300.00",
    });
  });

  it("never reports a zero or absent risk/overdue figure", () => {
    const result = computeInsights({ ...baseInput, capitalAtRisk: "0.00", overduePayable: undefined });
    expect(result).toEqual([]);
  });

  it("backs capital-at-risk and overdue-payables with the numbers behind them, so clicking either has real factors to show", () => {
    const result = computeInsights({
      ...baseInput,
      capitalAtRisk: "1500.00",
      openExposure: "5000.00",
      overduePayable: "300.00",
      upcomingPayable: "700.00",
      undatedPayable: "100.00",
    });
    expect(result.find((i) => i.id === "capital-at-risk")?.factors).toEqual([
      { label: "Capital em risco", value: "R$ 1500.00" },
      { label: "Exposição em aberto", value: "R$ 5000.00" },
      { label: "% da exposição em risco", value: "+30%" },
    ]);
    expect(result.find((i) => i.id === "overdue-payables")?.factors).toEqual([
      { label: "Vencido", value: "R$ 300.00" },
      { label: "A vencer", value: "R$ 700.00" },
      { label: "Sem vencimento definido", value: "R$ 100.00" },
    ]);
  });

  it("reports the book's own health trend only when it actually moved, with the point delta as detail", () => {
    const up = computeInsights({ ...baseInput, healthTrend: { trend: "up", trendDelta: 5 } });
    expect(up.find((i) => i.id === "health-trend-up")?.detail).toBe("+5 pontos");

    const flat = computeInsights({ ...baseInput, healthTrend: { trend: "up", trendDelta: 0.2 } });
    expect(flat.map((i) => i.id)).not.toContain("health-trend-up");
  });

  it("backs a health-trend insight with the score's own components, when they're known", () => {
    const result = computeInsights({
      ...baseInput,
      healthTrend: { trend: "up", trendDelta: 5, score: 74, closureQuality: 0.8, openBookHealth: 0.7, windowDays: 30 },
    });
    expect(result.find((i) => i.id === "health-trend-up")?.factors).toEqual([
      { label: "Variação", value: "+5" },
      { label: "Pontuação atual", value: "74" },
      { label: "Qualidade de fechamento", value: "80%" },
      { label: "Saúde do livro em aberto", value: "70%" },
      { label: "Janela analisada", value: "30" },
    ]);
  });

  it("orders bad news before warnings before good news", () => {
    const result = computeInsights({
      ...baseInput,
      previousPeriod: { cashIn: "2000", cashOut: "1000" },
      currentPeriod: { cashIn: "1000", cashOut: "1500" }, // revenue down (bad), spending up (bad)
      capitalAtRisk: "500.00", // warn
      healthTrend: { trend: "up", trendDelta: 4 }, // ok
    });
    const tones = result.map((i) => i.tone);
    const firstWarnIdx = tones.indexOf("warn");
    const firstOkIdx = tones.indexOf("ok");
    expect(tones.slice(0, firstWarnIdx).every((t) => t === "bad")).toBe(true);
    expect(firstOkIdx).toBeGreaterThan(firstWarnIdx);
  });
});
