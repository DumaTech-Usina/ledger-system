import { describe, it, expect } from "vitest";
import { GetReceivablesAgendaUseCase } from "../../../core/application/use-cases/GetReceivablesAgenda";
import type { PositionItem, PositionsPage, ReceivablesAgendaPage } from "../../../core/application/dtos/LedgerReadModels";
import type { PositionsQuery } from "../../../core/application/ports/LedgerReadPort";
import { ExternalSignal, type SignalKind } from "../../../core/domain/entities/ExternalSignal";
import { InMemoryExternalSignalRepository } from "../../../infra/persistence/InMemoryExternalSignalRepository";
import type { Party } from "../../../core/domain/entities/Party";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";

/**
 * §8.7 on the Treasury side (REQ-660–665): it shows what the Ledger published, names the payers, marks
 * what the insurer declared paid and the bank has not shown — a signal, never a receipt — and never
 * adds money up itself.
 */

const USINA = "party-usina";
const ALLIANZ = "insurer-allianz";

const line = (over: Partial<PositionItem> & { objectId: string }): PositionItem => ({
  objectType: "commission_receivable",
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "128.77",
  totalSettled: "0.00",
  openBalance: "128.77",
  eventCount: 1,
  lastEventAt: "2026-11-01T03:00:00.000Z",
  originatedAt: "2026-11-01T03:00:00.000Z",
  createdAt: "2026-11-01T03:00:00.000Z",
  dueAt: null,
  parties: [USINA, ALLIANZ],
  ...over,
});

const LINES = [
  line({ objectId: "seguro:apolice:5177:prevista" }),
  line({ objectId: "seguro:apolice:8812:prevista", totalOriginated: "2000.00", totalSettled: "1000.00", openBalance: "1000.00" }),
  line({ objectId: "rcv:manual", parties: [USINA] }),
];

const page = (over: Partial<ReceivablesAgendaPage> = {}): ReceivablesAgendaPage => ({
  asOf: "2026-11-13",
  windowDays: 7,
  windows: {
    overdue: { count: 0, totals: {} },
    today: { count: 0, totals: {} },
    next: { count: 0, totals: {} },
    later: { count: 0, totals: {} },
    // Deliberately NOT the sum of the lines: the Treasury must show the Ledger's figure.
    undated: { count: 3, totals: { BRL: "999.99" } },
  },
  unlinked: { count: 1, totals: { BRL: "100.00" } },
  payers: [
    { key: ALLIANZ, partyIds: [ALLIANZ], count: 2, totals: { BRL: "1128.77" } },
    { key: "", partyIds: [], count: 1, totals: { BRL: "128.77" } },
  ],
  payer: null,
  window: "undated",
  data: LINES,
  total: 3,
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

const directory = { list: async () => [party(ALLIANZ, "Allianz"), party(USINA, "Usina")] };

let n = 0;
const signal = (kind: SignalKind, policyId: string, fields: Record<string, string>, receivedAt: string) =>
  ExternalSignal.record({
    id: `sig-${++n}`,
    system: "insurance",
    kind,
    recordId: policyId,
    fields: { policyId, ...fields },
    contentHash: `h-${n}`,
    receivedAt,
    recordedBy: "cfo",
    proposals: [],
  });

async function useCase(opts: { down?: boolean; positions?: PositionItem[][] } = {}) {
  const signals = new InMemoryExternalSignalRepository();
  // 5177: declared 128.77, nothing received → unseen. 8812: declared 2000.00, 1000.00 received → unseen.
  await signals.add(signal("eligibility", "5177", { usinaValue: "128.77", eligibleAt: "2026-10-21", insurer: "Allianz", policyNumber: "5177…285" }, "2026-11-09T10:00:00Z"));
  await signals.add(signal("eligibility", "8812", { usinaValue: "1000.00", eligibleAt: "2026-10-01" }, "2026-11-08T10:00:00Z"));
  // A newer reading of 8812 declares the whole commission: the most recent one counts.
  await signals.add(signal("eligibility", "8812", { usinaValue: "2000.00", eligibleAt: "2026-10-01" }, "2026-11-10T10:00:00Z"));
  // A policy reading says nothing about a payment.
  await signals.add(signal("policy", "9034", { usinaValue: "50.00" }, "2026-11-10T11:00:00Z"));

  const pages = opts.positions ?? [LINES];
  const asked: PositionsQuery[] = [];
  const ledger = {
    receivablesAgenda: async () => {
      if (opts.down) throw new Error("down");
      return page();
    },
    positions: async (q?: PositionsQuery): Promise<PositionsPage> => {
      if (opts.down) throw new Error("down");
      asked.push(q!);
      const i = (q?.page ?? 1) - 1;
      return { data: pages[i] ?? [], total: 0, page: i + 1, limit: 200, totalPages: pages.length } as PositionsPage;
    },
  };
  return { asked, agenda: new GetReceivablesAgendaUseCase(ledger, signals, directory, USINA) };
}

describe("GetReceivablesAgenda", () => {
  it("CA-661b, REQ-601: windows, receipts with no origin and payers carry the Ledger's totals, never a sum made here", async () => {
    const result = await (await useCase()).agenda.execute({ window: "undated" });
    if (!result.available) throw new Error("unavailable");
    expect(result.windows.undated).toEqual({ count: 3, totals: { BRL: "999.99" } });
    expect(result.unlinked).toEqual({ count: 1, totals: { BRL: "100.00" } });
    expect(result.payers[0]).toMatchObject({ key: ALLIANZ, totals: { BRL: "1128.77" }, payers: [{ partyId: ALLIANZ, displayName: "Allianz" }] });
  });

  it("CA-662b, REJ-662: a line that names no payer has none — never guessed", async () => {
    const result = await (await useCase()).agenda.execute({});
    if (!result.available) throw new Error("unavailable");
    expect(result.lines.find((l) => l.objectId === "rcv:manual")!.payers).toEqual([]);
    expect(result.payers.find((g) => g.key === "")!.payers).toEqual([]);
  });

  it("CA-663: marks the line the insurer declared paid and the Ledger has not seen come in", async () => {
    const result = await (await useCase()).agenda.execute({});
    if (!result.available) throw new Error("unavailable");
    const [a, b, manual] = result.lines;
    expect(a.declared).toMatchObject({ policyId: "5177", claimed: "128.77", insurer: "Allianz", policyLabel: "5177…285" });
    expect(a.policyId).toBe("5177");
    // The most recent reading of 8812 declares 2000.00; 1000.00 came in → still unseen.
    expect(b.declared).toMatchObject({ claimed: "2000.00" });
    expect(b.partiallyReceived).toBe(true);
    expect(manual.declared).toBeNull();
    expect(manual.policyId).toBeNull();
  });

  it("CA-663b: received as much as declared → not marked", async () => {
    const { agenda } = await useCase({ positions: [[line({ objectId: "seguro:apolice:5177:prevista", totalSettled: "128.77", openBalance: "0.00" })]] });
    const declared = await agenda.declared();
    expect(declared.available && declared.lines).toEqual([]);
  });

  it("without the settled figure the comparison is unknown, and nothing is marked", async () => {
    const { agenda } = await useCase({ positions: [[{ ...line({ objectId: "seguro:apolice:5177:prevista" }), totalSettled: undefined }]] });
    const declared = await agenda.declared();
    expect(declared.available && declared.lines).toEqual([]);
  });

  it("REQ-663: the declared list walks every page of open expected commissions, oldest declaration first", async () => {
    const { agenda, asked } = await useCase({
      positions: [[LINES[0]], [LINES[1], LINES[2]]],
    });
    const declared = await agenda.declared();
    if (!declared.available) throw new Error("unavailable");
    expect(asked.map((q) => q.page)).toEqual([1, 2]);
    expect(asked[0]).toMatchObject({ objectType: "commission_receivable", status: ["open", "partially_settled"] });
    expect(declared.lines.map((l) => [l.policyId, l.claimed, l.received, l.open])).toEqual([
      ["8812", "2000.00", "1000.00", "1000.00"],
      ["5177", "128.77", "0.00", "128.77"],
    ]);
    expect(declared.lines[0]).toMatchObject({ payerKey: ALLIANZ, payers: [{ displayName: "Allianz" }] });
  });

  it("CA-665: with the Ledger down, the agenda and the declared list are unavailable, never empty", async () => {
    const { agenda } = await useCase({ down: true });
    expect(await agenda.execute({})).toEqual({ available: false });
    expect(await agenda.declared()).toEqual({ available: false });
  });
});
