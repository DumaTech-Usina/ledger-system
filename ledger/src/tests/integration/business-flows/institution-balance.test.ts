import { describe, it, expect } from "vitest";
import { createServer } from "http";
import { AddressInfo } from "net";
import express from "express";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { obligationRecognized, payrollPayment, retractPayroll } from "./helpers/commands/obligation-commands";
import { commissionExpected, commissionReceived } from "./helpers/commands/commission-commands";
import { institution, institutionTransfer, openingBalance } from "./helpers/commands/institution-commands";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { InstitutionBalanceService, signedAmount } from "../../../core/application/services/InstitutionBalanceService";
import { cashPositionRoutes } from "../../../presentation/web/api/routes/cashPositionRoutes";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { reporter, USINA } from "./helpers/parties";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { EventType } from "../../../core/domain/enums/EventType";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { Direction } from "../../../core/domain/enums/Direction";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";

/**
 * §8.8 (REQ-670–673, decided 2026-11-16): an institution's balance starts at what its statement showed
 * on the opening day, moves only by what came after, and is unknown — never zero — without an opening.
 * A transfer is one fact naming where the money left and where it arrived.
 */

const ref = makeRef();
const ZONE = "America/Sao_Paulo";
const day = (ymd: string) => new Date(`${ymd}T12:00:00-03:00`);
const at = institution;

const opening = (key: string, amount: string, ymd: string) => openingBalance(ref, key, amount, day(ymd));
const transfer = (from: string, to: string, amount: string, ymd: string, objects?: CreateLedgerEventCommand["objects"]) =>
  institutionTransfer(ref, from, to, amount, day(ymd), objects);

/** A payroll of `amount` paid on `ymd`, from `key` (or from no institution stated). */
async function pay(run: ReturnType<typeof setup>["run"], id: string, amount: string, ymd: string, key: string | null) {
  await run(obligationRecognized(ref, id, amount));
  const cmd = payrollPayment(ref, id, amount);
  return run({
    ...cmd,
    occurredAt: day(ymd),
    objects: [{ objectId: id, objectType: ObjectType.PAYROLL, relation: Relation.SETTLES }, ...(key ? [at(key)] : [])],
  });
}

async function receive(run: ReturnType<typeof setup>["run"], id: string, amount: string, ymd: string, key: string | null) {
  const expected = await run(commissionExpected(ref, id, amount));
  return run({
    ...commissionReceived(ref, id, expected.id.value, amount),
    occurredAt: day(ymd),
    objects: [{ objectId: id, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }, ...(key ? [at(key)] : [])],
  });
}

const service = (repo: ReturnType<typeof setup>["ledgerRepo"]) => new InstitutionBalanceService(repo, ZONE);
const brl = (units: Map<string, bigint> | null | undefined) => (units ? signedAmount(units.get("BRL") ?? 0n, "BRL") : null);

describe("REQ-670 — saldo de abertura", () => {
  it("CA-670, REJ-670: the opening starts the balance and is not money that came in", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("itau", "10000.00", "2026-11-30"));
    const read = await service(ledgerRepo).read({ asOf: "2026-11-30" });
    const itau = read.institutions.find((i) => i.institution === "instituicao:itau")!;
    expect(itau.opening).toMatchObject({ amountUnits: 1000000n, day: "2026-11-30" });
    expect(brl(itau.balance)).toBe("10000.00");
    // Out of every cash-flow total.
    const flows = await ledgerRepo.aggregateCashFlows();
    expect([flows.cashInUnits, flows.cashOutUnits]).toEqual([0n, 0n]);
    expect(await ledgerRepo.aggregatePeriodCashFlow(day("2026-11-01"), day("2026-12-31"))).toEqual([]);
    expect((await new CashPositionService(ledgerRepo).summarize()).totalCashIn.toString()).toBe("0.00");
  });

  it("CA-670b: an overdrawn account opens negative", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("bradesco", "-1200.00", "2026-11-30"));
    const read = await service(ledgerRepo).read({ asOf: "2026-12-01" });
    expect(brl(read.institutions[0].balance)).toBe("-1200.00");
  });

  it("an opening is the statement of exactly one institution, and moves no position", async () => {
    const { run } = setup();
    await expect(run({ ...opening("itau", "10.00", "2026-11-30"), objects: [] })).rejects.toThrow();
    await expect(run({ ...opening("itau", "10.00", "2026-11-30"), objects: [at("itau"), at("bradesco")] })).rejects.toThrow(/exactly one institution|at most one/);
    await expect(
      run({ ...opening("itau", "10.00", "2026-11-30"), objects: [at("itau"), { objectId: "p:1", objectType: ObjectType.PAYABLE, relation: Relation.SETTLES }] }),
    ).rejects.toThrow();
  });

  it("before its opening day, an institution's balance is unknown", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("itau", "10.00", "2026-11-30"));
    const read = await service(ledgerRepo).read({ asOf: "2026-11-29" });
    expect(read.institutions).toEqual([]);
    expect(read.known.institutions).toEqual([]);
  });
});

describe("REQ-671 — o que a abertura já contém", () => {
  it("CA-671: a payment dated up to the opening day does not move the balance; one after it does", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("itau", "10000.00", "2026-11-30"));
    await pay(run, "payroll:before", "500.00", "2026-11-28", "itau");
    await pay(run, "payroll:same-day", "50.00", "2026-11-30", "itau");
    await pay(run, "payroll:after", "500.00", "2026-12-01", "itau");
    await receive(run, "recv:after", "200.00", "2026-12-02", "itau");
    const itau = (await service(ledgerRepo).read({ asOf: "2026-12-05" })).institutions[0];
    expect([brl(itau.cashOut), brl(itau.cashIn), brl(itau.balance)]).toEqual(["500.00", "200.00", "9700.00"]);
  });

  it("the day read is the end of that day in São Paulo", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("itau", "100.00", "2026-11-30"));
    await pay(run, "payroll:late", "30.00", "2026-12-01", "itau");
    expect(brl((await service(ledgerRepo).read({ asOf: "2026-11-30" })).institutions[0].balance)).toBe("100.00");
    expect(brl((await service(ledgerRepo).read({ asOf: "2026-12-01" })).institutions[0].balance)).toBe("70.00");
  });
});

describe("REQ-672 — transferência entre instituições", () => {
  it("CA-672: one fact; one institution goes down, the other up, the usina's cash does not change", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("bradesco", "5000.00", "2026-11-30"));
    await run(opening("corretora", "0.01", "2026-11-30"));
    await run(transfer("bradesco", "corretora", "3000.00", "2026-12-02"));
    const read = await service(ledgerRepo).read({ asOf: "2026-12-02" });
    const by = Object.fromEntries(read.institutions.map((i) => [i.institution, brl(i.balance)]));
    expect(by).toEqual({ "instituicao:bradesco": "2000.00", "instituicao:corretora": "3000.01" });
    expect(brl(read.known.total)).toBe("5000.01");
    const flows = await ledgerRepo.aggregateCashFlows();
    expect([flows.cashInUnits, flows.cashOutUnits]).toEqual([0n, 0n]);
  });

  it("CA-672b: same origin and destination, or a missing side, is refused", async () => {
    const { run } = setup();
    await expect(run(transfer("itau", "itau", "10.00", "2026-12-02"))).rejects.toThrow(/must differ/);
    await expect(run(transfer("itau", "bradesco", "10.00", "2026-12-02", [at("itau", Relation.TRANSFERS_FROM)]))).rejects.toThrow(/exactly one/);
    await expect(run(transfer("itau", "bradesco", "10.00", "2026-12-02", [at("itau"), at("bradesco")]))).rejects.toThrow(/exactly one/);
  });

  it("only a transfer names where money left from or arrived in", async () => {
    const { run } = setup();
    await run(obligationRecognized(ref, "payroll:wrong", "10.00"));
    await expect(
      run({
        ...payrollPayment(ref, "payroll:wrong", "10.00"),
        objects: [{ objectId: "payroll:wrong", objectType: ObjectType.PAYROLL, relation: Relation.SETTLES }, at("itau", Relation.TRANSFERS_FROM)],
      }),
    ).rejects.toThrow(/Only an institution transfer/);
  });
});

describe("REQ-673 — saldo por instituição", () => {
  it("CA-673: without an opening the balance is unknown, never zero, and the known total leaves it out", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("bradesco", "1000.00", "2026-11-30"));
    await run(opening("itau", "2000.00", "2026-11-30"));
    await pay(run, "payroll:corretora", "100.00", "2026-12-01", "corretora");
    const read = await service(ledgerRepo).read({ asOf: "2026-12-01" });
    const corretora = read.institutions.find((i) => i.institution === "instituicao:corretora")!;
    expect(corretora.balance).toBeNull();
    expect(brl(corretora.cashOut)).toBe("100.00");
    expect(read.known).toMatchObject({ institutions: ["instituicao:bradesco", "instituicao:itau"] });
    expect(brl(read.known.total)).toBe("3000.00");
  });

  it("CA-673b, REJ-673: money citing no institution is apart from the first opening on, never spread", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("itau", "1000.00", "2026-11-30"));
    await pay(run, "payroll:old", "999.00", "2026-11-10", null);
    await receive(run, "recv:unknown", "250.00", "2026-12-03", null);
    await pay(run, "payroll:unknown", "40.00", "2026-12-04", null);
    const read = await service(ledgerRepo).read({ asOf: "2026-12-05" });
    expect(read.unknown).toMatchObject({ since: "2026-11-30", count: 2 });
    expect([brl(read.unknown.cashIn), brl(read.unknown.cashOut)]).toEqual(["250.00", "40.00"]);
    expect(brl(read.known.total)).toBe("1000.00");
  });

  it("a retracted fact never happened: it moves no balance", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("itau", "1000.00", "2026-11-30"));
    const wrong = await pay(run, "payroll:retracted", "300.00", "2026-12-01", "itau");
    await run(retractPayroll(ref, "payroll:retracted", wrong.id.value, "300.00"));
    const itau = (await service(ledgerRepo).read({ asOf: "2026-12-05" })).institutions[0];
    expect(brl(itau.balance)).toBe("1000.00");
  });
});

describe("GET /api/cash-position/institutions", () => {
  it("publishes signed amounts per currency, and null for an unknown balance", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("bradesco", "-1200.00", "2026-11-30"));
    await pay(run, "payroll:itau", "10.00", "2026-12-01", "itau");
    const api = createServer(
      express().use("/api/cash-position", cashPositionRoutes(new CashPositionService(ledgerRepo), new InstitutionBalanceService(ledgerRepo, ZONE))),
    );
    await new Promise<void>((resolve) => api.listen(0, resolve));
    const url = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/cash-position/institutions`;
    try {
      const body = (await (await fetch(`${url}?asOf=2026-12-01`)).json()) as { institutions: unknown[]; known: unknown };
      expect(body.institutions).toEqual([
        expect.objectContaining({ institution: "instituicao:bradesco", balance: { BRL: "-1200.00" }, opening: expect.objectContaining({ amount: "-1200.00", day: "2026-11-30" }) }),
        expect.objectContaining({ institution: "instituicao:itau", balance: null, cashOut: { BRL: "10.00" } }),
      ]);
      expect(body.known).toEqual({ total: { BRL: "-1200.00" }, institutions: ["instituicao:bradesco"] });
      expect((await fetch(`${url}?asOf=01-12-2026`)).status).toBe(400);
    } finally {
      await new Promise<void>((resolve) => api.close(() => resolve()));
    }
  });
});

describe("REQ-670, REQ-672 — uma abertura ou transferência errada é retificada, nunca editada", () => {
  const retraction = (targetId: string, keys: string[]): CreateLedgerEventCommand => ({
    eventType: EventType.LEDGER_CORRECTION,
    economicEffect: EconomicEffect.NON_CASH,
    occurredAt: day("2026-12-03"),
    amount: "1.00",
    currency: "BRL",
    sourceSystem: "treasury",
    sourceReference: ref("retraction"),
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-test",
    relatedEventId: targetId,
    parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
    objects: keys.map((k) => at(k, Relation.RETRACTS)),
    reason: { type: ReasonType.MANUAL_CORRECTION, description: "typed wrong", confidence: ConfidenceLevel.HIGH, requiresFollowup: true },
    reporter: reporter(),
  });

  it("the opening is withdrawn by naming its institution; then the balance is unknown until a new one", async () => {
    const { run, ledgerRepo } = setup();
    const wrong = await run(opening("itau", "1000.00", "2026-11-30"));
    await run(retraction(wrong.id.value, ["itau"]));
    expect((await service(ledgerRepo).read({ asOf: "2026-12-05" })).institutions[0]?.balance ?? null).toBeNull();
    await run(opening("itau", "1500.00", "2026-11-30"));
    expect(brl((await service(ledgerRepo).read({ asOf: "2026-12-05" })).institutions[0].balance)).toBe("1500.00");
  });

  it("a transfer is withdrawn by naming both institutions — leaving one out is refused", async () => {
    const { run, ledgerRepo } = setup();
    await run(opening("itau", "1000.00", "2026-11-30"));
    await run(opening("bradesco", "1000.00", "2026-11-30"));
    const wrong = await run(transfer("itau", "bradesco", "400.00", "2026-12-01"));
    await expect(run(retraction(wrong.id.value, ["itau"]))).rejects.toThrow(/every position/);
    await run(retraction(wrong.id.value, ["itau", "bradesco"]));
    const read = await service(ledgerRepo).read({ asOf: "2026-12-05" });
    expect(read.institutions.map((i) => brl(i.balance))).toEqual(["1000.00", "1000.00"]);
  });

  it("a payment is not retracted by its institution: it moved a position, and that is what it withdraws", async () => {
    const { run } = setup();
    const paid = await pay(run, "payroll:inst-retract", "10.00", "2026-12-01", "itau");
    await expect(run(retraction(paid.id.value, ["itau"]))).rejects.toThrow(/Only an opening balance or a transfer|every position/);
  });
});

