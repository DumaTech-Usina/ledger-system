import { describe, it, expect } from "vitest";
import { amountsUnreadable, buildDailyFlow } from "@/features/dashboard/CashFlowChart";
import type { CashMovement } from "@/types/dashboard";

const move = (occurredAt: string, effect: string, amount: string) =>
  ({ eventId: `${occurredAt}-${amount}`, occurredAt, recordedAt: occurredAt, effect, amount }) as CashMovement;

const TODAY = "2026-11-30";

describe("barras diárias de entrada e saída", () => {
  it("soma por dia e por direção", () => {
    const days = buildDailyFlow(
      [
        move("2026-11-03T12:00:00Z", "cash_in", "100.00"),
        move("2026-11-03T15:00:00Z", "cash_in", "50.00"),
        move("2026-11-03T16:00:00Z", "cash_out", "30.00"),
      ],
      TODAY,
    );

    expect(days.find((d) => d.date === "2026-11-03")).toMatchObject({ inflow: 150, outflow: 30 });
  });

  it("soma centavos sem o erro do ponto flutuante", () => {
    const [day] = buildDailyFlow(
      [move("2026-11-01T12:00:00Z", "cash_in", "0.10"), move("2026-11-01T12:00:00Z", "cash_in", "0.20")],
      TODAY,
    );

    expect(day.inflow).toBe(0.3);
  });

  it("REQ-601: não calcula saldo", () => {
    const [day] = buildDailyFlow([move("2026-11-01T12:00:00Z", "cash_in", "100.00")], TODAY);

    expect(day).not.toHaveProperty("balance");
  });

  it("o que não move caixa não entra nas barras", () => {
    expect(buildDailyFlow([move("2026-11-01T12:00:00Z", "non_cash", "100.00")], TODAY)).toEqual([]);
  });
});

describe("aviso de valor ilegível", () => {
  it("um valor ilegível não apaga os demais do gráfico", () => {
    const days = buildDailyFlow(
      [move("2026-11-01T12:00:00Z", "cash_in", "abc"), move("2026-11-02T12:00:00Z", "cash_in", "10.00")],
      TODAY,
    );

    expect(days.find((d) => d.date === "2026-11-02")?.inflow).toBe(10);
  });

  it("avisa quando um movimento de caixa não pôde ser desenhado", () => {
    expect(amountsUnreadable([move("2026-11-01T12:00:00Z", "cash_in", "abc")])).toBe(true);
  });

  it("fica quieto quando tudo foi lido, ou quando o ilegível não move caixa", () => {
    expect(amountsUnreadable([move("2026-11-01T12:00:00Z", "cash_in", "10.00")])).toBe(false);
    expect(amountsUnreadable([move("2026-11-01T12:00:00Z", "non_cash", "abc")])).toBe(false);
  });
});
