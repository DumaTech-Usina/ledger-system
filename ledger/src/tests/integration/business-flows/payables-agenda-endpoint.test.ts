import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import express from "express";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { BROKER, SUPPLIER, USINA } from "./helpers/parties";
import { obligationRecognized, payrollPayment, retractPayroll } from "./helpers/commands/obligation-commands";
import { advancePayment } from "./helpers/commands/advance-commands";
import { positionRoutes } from "../../../presentation/web/api/routes/positionRoutes";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { PayablesAgendaService, agendaDayOf, addDays } from "../../../core/application/services/PayablesAgendaService";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * GET /api/positions/agenda/payables — what the Usina owes and is still open, by due window, with the
 * total of each window published by the Ledger (treasury/docs/requisitos_refinados.md §8.5, REQ-640–645).
 *
 * The due dates carry their São Paulo offset, so the test reads the same in any process timezone.
 */
const ref = makeRef();
const AS_OF = "2026-11-13";
const ZONE = "America/Sao_Paulo";
const day = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`);

let api: Server;
let baseUrl: string;

interface Window {
  count: number;
  totals: Record<string, string>;
}
interface Agenda {
  asOf: string;
  windowDays: number;
  windows: Record<"overdue" | "today" | "next" | "later" | "undated", Window>;
  window: string;
  data: { objectId: string; objectType: string; openBalance: string; totalOriginated: string; dueAt: string | null; parties: string[] }[];
  total: number;
  page: number;
  totalPages: number;
}

const read = async (query = "") => {
  const res = await fetch(`${baseUrl}/api/positions/agenda/payables?asOf=${AS_OF}${query}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Agenda;
};
const ids = (agenda: Agenda) => agenda.data.map((d) => d.objectId);

/** One obligation, owed to `creditor`, of `objectType`, due on `dueAt` (or never stated). */
const owe = (objectId: string, amount: string, objectType: ObjectType, dueAt: Date | null, occurredAt = day("2026-11-01"), creditor = SUPPLIER) =>
  obligationRecognized(ref, objectId, amount, {
    occurredAt,
    dueAt,
    parties: obligationRecognized(ref, objectId, amount).parties.map((p) => (p.partyId === SUPPLIER ? { ...p, partyId: creditor } : p)),
    objects: [{ objectId, objectType, relation: Relation.ORIGINATES }],
  });

beforeAll(async () => {
  const s = setup();
  await s.run(owe("pay:overdue", "100.00", ObjectType.PAYROLL, day("2026-11-12")));
  await s.run(owe("pay:today", "200.00", ObjectType.COMMISSION_PAYABLE, day("2026-11-13"), day("2026-11-01"), BROKER));
  await s.run(owe("pay:next", "300.00", ObjectType.SERVICE_FEE, day("2026-11-20")));
  await s.run(owe("pay:later", "400.00", ObjectType.TAX, day("2026-11-21")));
  await s.run(owe("pay:undated-old", "50.00", ObjectType.COMMISSION_PAYABLE, null, day("2026-10-01"), BROKER));
  await s.run(owe("pay:undated-new", "70.00", ObjectType.PAYABLE, null, day("2026-11-05")));

  // Paid in part: 40 of 100 remain, still overdue. Paid in full: gone.
  await s.run(owe("pay:partial", "100.00", ObjectType.PAYROLL, day("2026-11-10")));
  await s.run(payrollPayment(ref, "pay:partial", "60.00", { occurredAt: day("2026-11-11") }));
  await s.run(owe("pay:settled", "80.00", ObjectType.PAYROLL, day("2026-11-10")));
  await s.run(payrollPayment(ref, "pay:settled", "80.00", { occurredAt: day("2026-11-11") }));

  // Retracted: never happened, so never owed.
  const wrong = await s.run(owe("pay:retracted", "90.00", ObjectType.PAYROLL, day("2026-11-12")));
  await s.run(retractPayroll(ref, "pay:retracted", wrong.id.value, "90.00"));

  // What someone owes the Usina is not on this agenda.
  await s.run(advancePayment(ref, "adv:receivable", "500.00"));

  const positions = new PositionProjectionService(s.ledgerRepo);
  const agenda = new PayablesAgendaService(s.ledgerRepo, positions, ZONE);
  api = createServer(express().use("/api/positions", positionRoutes(positions, agenda)));
  await new Promise<void>((resolve) => api.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => api.close(() => resolve())));

describe("REQ-640 — o que entra na agenda", () => {
  it("CA-640: a obrigação de comissão aberta está na agenda", async () => {
    expect(ids(await read("&window=today"))).toEqual(["pay:today"]);
  });

  it("CA-644, CA-644b: quitada e retirada saem; o que a Usina tem a receber nunca entra", async () => {
    const all = (await Promise.all(["overdue", "today", "next", "later", "undated"].map((w) => read(`&window=${w}`)))).flatMap(ids);
    expect(all).not.toContain("pay:settled");
    expect(all).not.toContain("pay:retracted");
    expect(all).not.toContain("adv:receivable");
    expect(all.sort()).toEqual(
      ["pay:later", "pay:next", "pay:overdue", "pay:partial", "pay:today", "pay:undated-new", "pay:undated-old"].sort(),
    );
  });

  it("CA-644: a paga em parte mostra o que falta e o original", async () => {
    const line = (await read("&window=overdue")).data.find((d) => d.objectId === "pay:partial")!;
    expect(line).toMatchObject({ openBalance: "40.00", totalOriginated: "100.00" });
  });

  it("publica as partes de cada linha, para o Treasury mostrar o credor", async () => {
    const line = (await read("&window=today")).data[0];
    expect(line.parties.sort()).toEqual([BROKER, USINA].sort());
  });
});

describe("REQ-641, REQ-642 — janelas e totais", () => {
  it("CA-641: cada posição cai em exatamente uma janela pelo vencimento", async () => {
    const agenda = await read();
    expect(agenda.windowDays).toBe(7);
    expect(Object.fromEntries(Object.entries(agenda.windows).map(([k, v]) => [k, v.count]))).toEqual({
      overdue: 2,
      today: 1,
      next: 1,
      later: 1,
      undated: 2,
    });
    expect(ids(await read("&window=next"))).toEqual(["pay:next"]);
    expect(ids(await read("&window=later"))).toEqual(["pay:later"]);
  });

  it("CA-642: o total de cada janela é publicado pelo Ledger e é a soma do que está em aberto nela", async () => {
    const { windows } = await read();
    expect(windows.overdue.totals).toEqual({ BRL: "140.00" });
    expect(windows.today.totals).toEqual({ BRL: "200.00" });
    expect(windows.next.totals).toEqual({ BRL: "300.00" });
    expect(windows.later.totals).toEqual({ BRL: "400.00" });
    expect(windows.undated.totals).toEqual({ BRL: "120.00" });
  });

  it("REJ-641: o que não tem vencimento nunca é vencido nem de hoje", async () => {
    const undated = await read("&window=undated");
    expect(undated.data.every((d) => d.dueAt === null)).toBe(true);
    for (const w of ["overdue", "today"]) expect((await read(`&window=${w}`)).data.every((d) => d.dueAt !== null)).toBe(true);
  });

  it("a janela de próximos dias é ajustável (Q-055)", async () => {
    const agenda = await read("&windowDays=8");
    expect(agenda.windows.next.count).toBe(2);
    expect(agenda.windows.later.count).toBe(0);
  });

  it("um dia depois, o que vencia hoje passa a vencido, sem nenhum fato novo", async () => {
    const res = await fetch(`${baseUrl}/api/positions/agenda/payables?asOf=2026-11-14`);
    const agenda = (await res.json()) as Agenda;
    expect(agenda.windows.overdue.count).toBe(3);
    expect(agenda.windows.today.count).toBe(0);
  });
});

describe("REQ-643 — a ordem", () => {
  it("vencidas do vencimento mais antigo para o mais novo", async () => {
    expect(ids(await read("&window=overdue"))).toEqual(["pay:partial", "pay:overdue"]);
  });

  it("CA-643: sem vencimento, da aberta há mais tempo para a mais nova", async () => {
    expect(ids(await read("&window=undated"))).toEqual(["pay:undated-old", "pay:undated-new"]);
  });

  it("pagina dentro da janela", async () => {
    const first = await read("&window=undated&limit=1&page=1");
    const second = await read("&window=undated&limit=1&page=2");
    expect([ids(first), ids(second), first.total, first.totalPages]).toEqual([["pay:undated-old"], ["pay:undated-new"], 2, 2]);
  });
});

describe("REQ-641, REQ-225 — o dia é o de São Paulo", () => {
  it("CA-641b: às 23h de São Paulo ainda é o mesmo dia, embora em UTC já seja o seguinte", () => {
    expect(agendaDayOf(new Date("2026-11-14T02:00:00Z"), ZONE)).toBe("2026-11-13");
    expect(agendaDayOf(new Date("2026-11-14T03:00:00Z"), ZONE)).toBe("2026-11-14");
  });

  it("um vencimento à meia-noite de São Paulo é daquele dia", async () => {
    expect(agendaDayOf(day("2026-11-13"), ZONE)).toBe("2026-11-13");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("recusa uma data, uma janela ou um tamanho de janela inválidos", async () => {
    for (const q of ["asOf=13-11-2026", `asOf=${AS_OF}&window=ontem`, `asOf=${AS_OF}&windowDays=-1`]) {
      expect((await fetch(`${baseUrl}/api/positions/agenda/payables?${q}`)).status).toBe(400);
    }
  });
});
