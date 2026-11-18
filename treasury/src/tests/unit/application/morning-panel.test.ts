import { describe, it, expect } from "vitest";
import { GetMorningPanelUseCase } from "../../../core/application/use-cases/GetMorningPanel";
import type { InstitutionsResult } from "../../../core/application/use-cases/InstitutionCash";
import type { AgendaDay, PayablesAgendaPage, ReceivablesAgendaPage } from "../../../core/application/dtos/LedgerReadModels";

/**
 * §8.10 (E7): the morning panel puts the Ledger's own figures side by side — the known cash, what falls
 * due day by day, and apart what is expected — and adds, nets or concludes nothing itself.
 */

const none = { count: 0, totals: {} };
const day = (d: string, total?: string): AgendaDay => ({ day: d, count: total ? 1 : 0, totals: total ? { BRL: total } : {} });

const payables: PayablesAgendaPage = {
  asOf: "2026-11-17",
  windowDays: 7,
  windows: {
    overdue: { count: 2, totals: { BRL: "140.00" } },
    today: { count: 1, totals: { BRL: "200.00" } },
    next: { count: 2, totals: { BRL: "150.00" } },
    later: { count: 1, totals: { BRL: "400.00" } },
    undated: { count: 3, totals: { BRL: "999.99" } },
  },
  days: [day("2026-11-17", "200.00"), day("2026-11-18", "100.00"), day("2026-11-19"), day("2026-11-20", "50.00")],
  window: "overdue",
  data: [],
  total: 2,
  page: 1,
  limit: 1,
  totalPages: 2,
};

const receivables: ReceivablesAgendaPage = {
  ...payables,
  windows: { ...payables.windows, overdue: { count: 1, totals: { BRL: "128.77" } }, undated: { count: 320, totals: { BRL: "405469.72" } } },
  days: [day("2026-11-17"), day("2026-11-18", "1000.00"), day("2026-11-19"), day("2026-11-20")],
  unlinked: none,
  payers: [],
  payer: null,
  window: "overdue",
};

const balances: InstitutionsResult = {
  available: true,
  asOf: "2026-11-17",
  institutions: [
    { key: "bradesco", name: "Bradesco", configured: true, opening: { amount: "500000.00", day: "2026-11-02", eventId: "e1" }, cashIn: "0.00", cashOut: "0.00", transfersIn: "0.00", transfersOut: "0.00", balance: "295600.51", statement: null },
    { key: "itau", name: "Itaú", configured: true, opening: { amount: "400000.00", day: "2026-11-02", eventId: "e2" }, cashIn: "0.00", cashOut: "0.00", transfersIn: "0.00", transfersOut: "0.00", balance: "257705.77", statement: null },
    { key: "corretora", name: "Corretora de investimentos", configured: true, opening: null, cashIn: "0.00", cashOut: "0.00", transfersIn: "0.00", transfersOut: "0.00", balance: null, statement: null },
  ],
  known: { total: "553306.28", institutions: ["Bradesco", "Itaú"] },
  unknown: { since: "2026-11-02", cashIn: "0.00", cashOut: "56828.41", count: 10 },
};

function panel(opts: { down?: "agenda" | "cash" | "balances" } = {}) {
  const asked: unknown[] = [];
  return {
    asked,
    useCase: new GetMorningPanelUseCase(
      {
        payablesAgenda: async (q) => {
          asked.push(q);
          if (opts.down === "agenda") throw new Error("down");
          return payables;
        },
        receivablesAgenda: async (q) => {
          asked.push(q);
          return receivables;
        },
      },
      {
        read: async () => {
          if (opts.down === "cash") throw new Error("down");
          return opts.down === "balances" ? { available: false } : balances;
        },
      },
    ),
  };
}

describe("GetMorningPanel (§8.10)", () => {
  it("CA-681: the known cash is the Ledger's; an institution without opening is unknown and named as left out", async () => {
    const result = await panel().useCase.execute();
    if (!result.available) throw new Error("unavailable");
    expect(result.cash.known).toEqual({ total: "553306.28", institutions: ["Bradesco", "Itaú"] });
    expect(result.cash.institutions.find((i) => i.key === "corretora")!.balance).toBeNull();
    expect(result.cash.missingOpening).toEqual(["Corretora de investimentos"]);
    expect(result.cash.unknown).toMatchObject({ cashOut: "56828.41", count: 10 });
  });

  it("CA-682, CA-683: what falls due and what is expected keep the agendas' columns and the Ledger's totals", async () => {
    const result = await panel().useCase.execute();
    if (!result.available) throw new Error("unavailable");
    expect(result.payables.overdue).toEqual({ count: 2, totals: { BRL: "140.00" } });
    expect(result.payables.days.map((d) => d.totals.BRL ?? null)).toEqual(["200.00", "100.00", null, "50.00"]);
    // Undated is apart, never in a day.
    expect(result.payables.undated).toEqual({ count: 3, totals: { BRL: "999.99" } });
    expect(result.receivables.days[1]).toEqual({ day: "2026-11-18", count: 1, totals: { BRL: "1000.00" } });
    expect(result.receivables.undated.totals).toEqual({ BRL: "405469.72" });
  });

  it("CA-684, REJ-683: nothing is summed, netted or concluded here", async () => {
    const result = await panel().useCase.execute();
    const text = JSON.stringify(result);
    // Every amount is one the Ledger published; no surplus, no shortfall, no grand total.
    const amounts = new Set(text.match(/\d+\.\d{2}/g));
    const published = new Set(JSON.stringify([payables, receivables, balances]).match(/\d+\.\d{2}/g));
    expect([...amounts].filter((a) => !published.has(a))).toEqual([]);
    expect(Object.keys(result)).not.toContain("surplus");
  });

  it("CA-680: reads today — the agendas are asked with no date and no window, only for their totals", async () => {
    const { useCase, asked } = panel();
    await useCase.execute();
    expect(asked).toEqual([{ limit: 1 }, { limit: 1 }]);
  });

  it("CA-685: any part the Ledger cannot answer makes the panel unavailable, never zero", async () => {
    expect(await panel({ down: "agenda" }).useCase.execute()).toEqual({ available: false });
    expect(await panel({ down: "cash" }).useCase.execute()).toEqual({ available: false });
    expect(await panel({ down: "balances" }).useCase.execute()).toEqual({ available: false });
  });
});
