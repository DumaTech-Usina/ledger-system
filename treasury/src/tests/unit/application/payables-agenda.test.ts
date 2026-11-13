import { describe, it, expect } from "vitest";
import { GetPayablesAgendaUseCase } from "../../../core/application/use-cases/GetPayablesAgenda";
import type { PayablesAgendaPort } from "../../../core/application/ports/PayablesAgendaPort";
import type { PayablesAgendaPage, PositionItem } from "../../../core/application/dtos/LedgerReadModels";
import type { Party } from "../../../core/domain/entities/Party";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";

/**
 * §8.5 on the Treasury side (REQ-640–645): it shows what the Ledger published, names the creditor, and
 * never adds money up itself.
 */

const USINA = "party-usina";

const line = (over: Partial<PositionItem> & { objectId: string }): PositionItem => ({
  objectType: "commission_payable",
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "100.00",
  openBalance: "100.00",
  eventCount: 1,
  lastEventAt: "2026-11-01T03:00:00.000Z",
  originatedAt: "2026-11-01T03:00:00.000Z",
  createdAt: "2026-11-01T03:00:00.000Z",
  dueAt: null,
  parties: [USINA, "broker-1"],
  ...over,
});

const page = (over: Partial<PayablesAgendaPage> = {}): PayablesAgendaPage => ({
  asOf: "2026-11-13",
  windowDays: 7,
  windows: {
    overdue: { count: 0, totals: {} },
    today: { count: 0, totals: {} },
    next: { count: 0, totals: {} },
    later: { count: 0, totals: {} },
    // Deliberately NOT the sum of the lines below: the Treasury must show the Ledger's figure.
    undated: { count: 2, totals: { BRL: "999.99" } },
  },
  window: "undated",
  data: [line({ objectId: "a" }), line({ objectId: "b", openBalance: "40.00", originatedAt: "2026-11-12T15:00:00.000Z" })],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...over,
});

const party = (partyId: string, displayName: string): Party => ({
  partyId,
  displayName,
  identityState: PartyIdentityState.IDENTIFIED,
  aliases: [],
  externalIds: [],
  attributes: {},
});

const directory = { list: async () => [party("broker-1", "Halisson Corretor"), party(USINA, "Usina")] };

function useCase(ledger: Partial<PayablesAgendaPort> & { calls?: unknown[] } = {}) {
  const calls: unknown[] = [];
  const port: PayablesAgendaPort = {
    payablesAgenda: async (q) => {
      calls.push(q);
      return page();
    },
    ...ledger,
  };
  return { calls, agenda: new GetPayablesAgendaUseCase(port, directory, USINA) };
}

describe("GetPayablesAgenda", () => {
  it("REQ-642, REJ-642: the totals are the Ledger's, never a sum made here", async () => {
    const result = await useCase().agenda.execute({ window: "undated" });
    expect(result.available && result.windows.undated).toEqual({ count: 2, totals: { BRL: "999.99" } });
  });

  it("REQ-644: names the creditor — the party that is not the Usina", async () => {
    const result = await useCase().agenda.execute({ window: "undated" });
    expect(result.available && result.lines[0].creditors).toEqual([{ partyId: "broker-1", displayName: "Halisson Corretor" }]);
  });

  it("REQ-644: an unknown creditor keeps its id rather than vanishing", async () => {
    const { agenda } = useCase({
      payablesAgenda: async () => page({ data: [line({ objectId: "x", parties: [USINA, "nobody-we-know"] })] }),
    });
    const result = await agenda.execute({});
    expect(result.available && result.lines[0].creditors).toEqual([{ partyId: "nobody-we-know", displayName: "nobody-we-know" }]);
  });

  it("REQ-643: an undated line says how long it has been open, in São Paulo days", async () => {
    const result = await useCase().agenda.execute({ window: "undated" });
    expect(result.available && result.lines.map((l) => l.openForDays)).toEqual([12, 1]);
  });

  it("REQ-644: a line paid in part says so, with the original amount", async () => {
    const result = await useCase().agenda.execute({ window: "undated" });
    expect(result.available && result.lines.map((l) => [l.openBalance, l.totalOriginated, l.partiallyPaid])).toEqual([
      ["100.00", "100.00", false],
      ["40.00", "100.00", true],
    ]);
  });

  it("asks the Ledger for the window, page and window size it was given", async () => {
    const { agenda, calls } = useCase();
    await agenda.execute({ window: "next", page: 2, limit: 50, windowDays: 10 });
    expect(calls).toEqual([{ window: "next", page: 2, limit: 50, windowDays: 10 }]);
  });

  it("CA-645: with the Ledger down the agenda is unavailable — never an empty window nor a zero total", async () => {
    const { agenda } = useCase({ payablesAgenda: async () => { throw new Error("ECONNREFUSED"); } });
    expect(await agenda.execute({})).toEqual({ available: false });
  });
});
