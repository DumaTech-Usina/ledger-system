import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import express from "express";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { BROKER, OPERATOR, SUPPLIER, USINA } from "./helpers/parties";
import { commissionExpected, commissionReceived } from "./helpers/commands/commission-commands";
import { advancePayment } from "./helpers/commands/advance-commands";
import { loanOrigination } from "./helpers/commands/loan-commands";
import { obligationRecognized } from "./helpers/commands/obligation-commands";
import { positionRoutes } from "../../../presentation/web/api/routes/positionRoutes";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { PayablesAgendaService } from "../../../core/application/services/PayablesAgendaService";
import { ReceivablesAgendaService, payerKey } from "../../../core/application/services/ReceivablesAgendaService";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * GET /api/positions/agenda/receivables — what is owed to the Usina and still open, by expected date,
 * by payer, and the money that came in with no known origin (treasury/docs/requisitos_refinados.md §8.7,
 * REQ-660–665). A reading of the chain: it changes no fact and no rule.
 */
const ref = makeRef();
const AS_OF = "2026-11-13";
const ZONE = "America/Sao_Paulo";
const day = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`);
const PORTO = "operator-porto";

let api: Server;
let baseUrl: string;

interface Summary {
  count: number;
  totals: Record<string, string>;
}
interface Agenda {
  asOf: string;
  windowDays: number;
  windows: Record<"overdue" | "today" | "next" | "later" | "undated", Summary>;
  unlinked: Summary;
  payers: (Summary & { key: string; partyIds: string[] })[];
  payer: string | null;
  window: string;
  data: { objectId: string; objectType: string; status: string; openBalance: string | null; totalOriginated: string; totalSettled: string; dueAt: string | null; parties: string[] }[];
  total: number;
  page: number;
  totalPages: number;
}

const read = async (query = "") => {
  const res = await fetch(`${baseUrl}/api/positions/agenda/receivables?asOf=${AS_OF}${query}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Agenda;
};
const ids = (agenda: Agenda) => agenda.data.map((d) => d.objectId);
const WINDOWS = ["overdue", "today", "next", "later", "undated"];

/** An expected commission, paid by `payer` (or by nobody named), expected on `dueAt`. */
const expect_ = (objectId: string, amount: string, dueAt: Date | null, payer: string | null = OPERATOR, occurredAt = day("2026-11-01")): CreateLedgerEventCommand => ({
  ...commissionExpected(ref, objectId, amount),
  occurredAt,
  dueAt,
  parties: [
    { partyId: USINA, role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL },
    ...(payer ? [{ partyId: payer, role: PartyRole.PAYER, direction: Direction.NEUTRAL }] : []),
  ],
});

/** Money that came in from the operator against a receivable, with or without its origin known. */
const receive = (objectId: string, amount: string, origin: string | null, occurredAt = day("2026-11-05")): CreateLedgerEventCommand => {
  const base = commissionReceived(ref, objectId, origin ?? "", amount);
  return {
    ...base,
    occurredAt,
    relatedEventId: origin ?? undefined,
    parties: [
      { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount },
      { partyId: OPERATOR, role: PartyRole.PAYER, direction: Direction.NEUTRAL, amount },
    ],
    reason: origin
      ? base.reason
      : { type: ReasonType.UNKNOWN_ORIGIN, description: "commission received; origin unknown", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: true },
  };
};

beforeAll(async () => {
  const s = setup();
  await s.run(expect_("rcv:overdue", "100.00", day("2026-11-12")));
  await s.run(expect_("rcv:today", "200.00", day("2026-11-13"), PORTO));
  await s.run(expect_("rcv:next", "300.00", day("2026-11-20")));
  await s.run(expect_("rcv:later", "400.00", day("2026-11-21")));
  await s.run(expect_("rcv:undated-old", "50.00", null, OPERATOR, day("2026-10-01")));
  await s.run(expect_("rcv:no-payer", "70.00", null, null, day("2026-11-05")));

  // Received in part: 40 of 100 remain, still overdue. Received in full: gone.
  const partial = await s.run(expect_("rcv:partial", "100.00", day("2026-11-10")));
  await s.run(receive("rcv:partial", "60.00", partial.id.value));
  const settled = await s.run(expect_("rcv:settled", "80.00", day("2026-11-10")));
  await s.run(receive("rcv:settled", "80.00", settled.id.value));

  // Money in, origin unknown: not a debt of anyone, listed apart.
  await s.run(receive("rcv:orphan", "100.00", null, day("2026-11-02")));

  // Lent and advanced to a broker: owed back to the Usina, with no stated date.
  await s.run({ ...loanOrigination(ref, "loan:broker", "1000.00"), occurredAt: day("2026-09-01") });
  await s.run({ ...advancePayment(ref, "adv:broker", "500.00"), occurredAt: day("2026-09-15") });

  // What the Usina owes is never on this agenda.
  await s.run(obligationRecognized(ref, "pay:supplier", "900.00", { dueAt: day("2026-11-12") }));

  const positions = new PositionProjectionService(s.ledgerRepo);
  const payables = new PayablesAgendaService(s.ledgerRepo, positions, ZONE);
  const receivables = new ReceivablesAgendaService(s.ledgerRepo, positions, ZONE, USINA);
  api = createServer(express().use("/api/positions", positionRoutes(positions, payables, receivables)));
  await new Promise<void>((resolve) => api.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => api.close(() => resolve())));

describe("REQ-660 — o que entra", () => {
  it("CA-660: comissão prevista, empréstimo e adiantamento em aberto; nada do que a Usina deve", async () => {
    const all = (await Promise.all(WINDOWS.map((w) => read(`&window=${w}`)))).flatMap(ids);
    expect(all.sort()).toEqual(
      ["adv:broker", "loan:broker", "rcv:later", "rcv:next", "rcv:no-payer", "rcv:overdue", "rcv:partial", "rcv:today", "rcv:undated-old"].sort(),
    );
    expect(all).not.toContain("pay:supplier");
    expect(all).not.toContain("rcv:settled");
    expect(all).not.toContain("rcv:orphan");
  });

  it("recebida em parte mostra o que falta e o original", async () => {
    const line = (await read("&window=overdue")).data.find((d) => d.objectId === "rcv:partial")!;
    expect(line).toMatchObject({ openBalance: "40.00", totalOriginated: "100.00", totalSettled: "60.00" });
  });
});

describe("REQ-661 — janelas e totais", () => {
  it("CA-661: cada posição cai numa janela pela data esperada; sem data nunca é vencida", async () => {
    const agenda = await read();
    expect(Object.fromEntries(Object.entries(agenda.windows).map(([k, v]) => [k, v.count]))).toEqual({
      overdue: 2,
      today: 1,
      next: 1,
      later: 1,
      undated: 4,
    });
    expect((await read("&window=undated")).data.every((d) => d.dueAt === null)).toBe(true);
    expect((await read("&window=overdue")).data.every((d) => d.dueAt !== null)).toBe(true);
  });

  it("CA-661b: o total de cada janela é publicado pelo Ledger", async () => {
    const { windows } = await read();
    expect(windows.overdue.totals).toEqual({ BRL: "140.00" });
    expect(windows.today.totals).toEqual({ BRL: "200.00" });
    expect(windows.undated.totals).toEqual({ BRL: "1620.00" });
  });

  it("sem data, da aberta há mais tempo para a mais nova", async () => {
    expect(ids(await read("&window=undated"))).toEqual(["loan:broker", "adv:broker", "rcv:undated-old", "rcv:no-payer"]);
  });
});

describe("REQ-662 — por pagador", () => {
  it("publica cada pagador com quantas posições e quanto está em aberto, sem a Usina", async () => {
    const { payers } = await read();
    const byKey = Object.fromEntries(payers.map((p) => [p.key, p]));
    expect(byKey[OPERATOR]).toMatchObject({ partyIds: [OPERATOR], count: 5, totals: { BRL: "890.00" } });
    expect(byKey[PORTO]).toMatchObject({ partyIds: [PORTO], count: 1, totals: { BRL: "200.00" } });
    expect(byKey[BROKER]).toMatchObject({ partyIds: [BROKER], count: 2, totals: { BRL: "1500.00" } });
    expect(payers.flatMap((p) => p.partyIds)).not.toContain(USINA);
  });

  it("CA-662b, REJ-662: sem pagador nomeado fica em 'não informado', nunca suposto", async () => {
    const { payers } = await read();
    expect(payers.find((p) => p.key === "")).toMatchObject({ partyIds: [], count: 1, totals: { BRL: "70.00" } });
    const unknown = await read("&window=undated&payer=");
    expect(ids(unknown)).toEqual(["rcv:no-payer"]);
  });

  it("CA-662: escolhido um pagador, janelas, totais e linhas são só dele", async () => {
    const agenda = await read(`&payer=${OPERATOR}&window=overdue`);
    expect(agenda.payer).toBe(OPERATOR);
    expect(agenda.windows.today).toEqual({ count: 0, totals: {} });
    expect(agenda.windows.overdue).toEqual({ count: 2, totals: { BRL: "140.00" } });
    expect(ids(agenda)).toEqual(["rcv:partial", "rcv:overdue"]);
    // The payer list still shows everyone, to switch to another.
    expect(agenda.payers.length).toBe(4);
  });

  it("um pagador desconhecido não acha nada; não é erro", async () => {
    const agenda = await read("&payer=ninguem");
    expect(agenda.windows.overdue.count).toBe(0);
    expect(agenda.unlinked.count).toBe(0);
  });
});

describe("REQ-664 — recebimentos sem origem", () => {
  it("CA-664: aparecem à parte, com o total recebido publicado pelo Ledger", async () => {
    const agenda = await read("&window=unlinked");
    expect(agenda.unlinked).toEqual({ count: 1, totals: { BRL: "100.00" } });
    expect(ids(agenda)).toEqual(["rcv:orphan"]);
    expect(agenda.data[0]).toMatchObject({ status: "unknown_origin", openBalance: null, totalSettled: "100.00" });
  });

  it("filtrados pelo pagador também", async () => {
    expect((await read(`&payer=${OPERATOR}`)).unlinked.count).toBe(1);
    expect((await read(`&payer=${PORTO}`)).unlinked.count).toBe(0);
  });
});

describe("leitura", () => {
  it("um dia depois, o que era esperado hoje passa a vencido, sem nenhum fato novo", async () => {
    const res = await fetch(`${baseUrl}/api/positions/agenda/receivables?asOf=2026-11-14`);
    const agenda = (await res.json()) as Agenda;
    expect(agenda.windows.overdue.count).toBe(3);
    expect(agenda.windows.today.count).toBe(0);
  });

  it("recusa uma data ou uma janela inválidas", async () => {
    for (const q of ["asOf=13-11-2026", `asOf=${AS_OF}&window=ontem`, `asOf=${AS_OF}&windowDays=-1`]) {
      expect((await fetch(`${baseUrl}/api/positions/agenda/receivables?${q}`)).status).toBe(400);
    }
  });

  it("a agenda a pagar continua só com o que a Usina deve", async () => {
    const res = await fetch(`${baseUrl}/api/positions/agenda/payables?asOf=${AS_OF}&window=overdue`);
    const agenda = (await res.json()) as Agenda;
    expect(ids(agenda)).toEqual(["pay:supplier"]);
  });
});

describe("payerKey (REQ-662)", () => {
  it("mais de uma outra parte forma um grupo próprio; a Usina nunca é pagadora de si mesma", () => {
    expect(payerKey(["b", USINA, "a", "a"], USINA)).toBe("a,b");
    expect(payerKey([USINA], USINA)).toBe("");
    expect(payerKey([SUPPLIER], USINA)).toBe(SUPPLIER);
  });
});
