import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { USINA, OPERATOR, TAX_AUTH, reporter } from "./helpers/parties";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { CashStatementService } from "../../../core/application/services/CashStatementService";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * Acceptance criteria of `treasury/docs/requisitos_refinados.md` §4.5, §8.3 and REQ-525, written
 * before the code they describe.
 *
 * `pending` marks a rule that is decided but not implemented. It runs the test and expects it to
 * fail, so the suite stays green and the test turns red the moment the rule exists: that is the cue
 * to replace `pending` with `it`. Run with ACCEPTANCE_STRICT=1 to see each one fail for its reason.
 *
 * The names below that do not exist yet (the compensation type and reason, the `compensated`
 * outcome, ResultService) are this suite's proposal for them. Only this file needs changing if the
 * implementation settles on others.
 */
const pending = process.env.ACCEPTANCE_STRICT ? it : it.fails;

const COMPENSATION = "compensation" as EventType;
const COMPENSATION_REASON = "compensation" as ReasonType;

const JOAO = "broker-joao";
const MARIA = "broker-maria";
const CORRETOR_A = "broker-a";
const CORRETOR_B = "broker-b";
const CORRETOR_C = "broker-c";
const SUPERVISOR = "supervisor-s";

type Party = { partyId: string; role: PartyRole; direction: Direction; amount?: string };
type Cited = { objectId: string; objectType: ObjectType; relation: Relation };

const ref = makeRef();

const event = (
  eventType: EventType,
  economicEffect: EconomicEffect,
  amount: string,
  parties: Party[],
  objects: Cited[],
  reasonType: ReasonType,
  extra: Partial<CreateLedgerEventCommand> = {},
): CreateLedgerEventCommand => ({
  eventType,
  economicEffect,
  occurredAt: new Date("2026-03-10T12:00:00.000Z"),
  amount,
  currency: "BRL",
  sourceSystem: "acceptance",
  sourceReference: ref(eventType),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties,
  objects,
  reason: {
    type: reasonType,
    description: "acceptance scenario",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
  ...extra,
});

const neutral = (partyId: string, role: PartyRole): Party => ({ partyId, role, direction: Direction.NEUTRAL });
const context = (objectId: string): Cited => ({
  objectId,
  objectType: ObjectType.PROPOSAL,
  relation: Relation.REFERENCES,
});
const inContext = (id?: string): Cited[] => (id ? [context(id)] : []);

const advance = (objectId: string, partyId: string, amount: string, extra: Partial<CreateLedgerEventCommand> = {}) =>
  event(
    EventType.ADVANCE_PAYMENT,
    EconomicEffect.CASH_OUT,
    amount,
    [{ partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount }, neutral(partyId, PartyRole.BENEFICIARY)],
    [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
    ReasonType.ADVANCE_PAYMENT,
    extra,
  );

const obligation = (objectId: string, partyId: string, amount: string, contextId?: string) =>
  event(
    EventType.OBLIGATION_RECOGNIZED,
    EconomicEffect.NON_CASH,
    amount,
    [neutral(USINA, PartyRole.PAYER), neutral(partyId, PartyRole.BENEFICIARY)],
    [{ objectId, objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.ORIGINATES }, ...inContext(contextId)],
    ReasonType.OBLIGATION_RECOGNITION,
  );

const loan = (objectId: string, partyId: string, amount: string) =>
  event(
    EventType.LOAN_ORIGINATION,
    EconomicEffect.CASH_OUT,
    amount,
    [{ partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount }, neutral(partyId, PartyRole.BENEFICIARY)],
    [{ objectId, objectType: ObjectType.LOAN, relation: Relation.ORIGINATES }],
    ReasonType.LOAN_ORIGINATION,
  );

/** An obligation of a type outside DEC-025, to prove the compensation does not reach it. */
const payrollObligation = (objectId: string, partyId: string, amount: string) =>
  event(
    EventType.OBLIGATION_RECOGNIZED,
    EconomicEffect.NON_CASH,
    amount,
    [neutral(USINA, PartyRole.PAYER), neutral(partyId, PartyRole.BENEFICIARY)],
    [{ objectId, objectType: ObjectType.PAYROLL, relation: Relation.ORIGINATES }],
    ReasonType.OBLIGATION_RECOGNITION,
  );

const compensation = (amount: string, partyIds: string[], positions: [string, ObjectType][], contextId?: string) =>
  event(
    COMPENSATION,
    EconomicEffect.NON_CASH,
    amount,
    partyIds.map((id) => neutral(id, PartyRole.BENEFICIARY)),
    [
      ...positions.map(([objectId, objectType]) => ({ objectId, objectType, relation: Relation.SETTLES })),
      ...inContext(contextId),
    ],
    COMPENSATION_REASON,
  );

const expected = (objectId: string, partyId: string, amount: string, contextId: string) =>
  event(
    EventType.COMMISSION_EXPECTED,
    EconomicEffect.NON_CASH,
    amount,
    [neutral(OPERATOR, PartyRole.PAYER), neutral(USINA, PartyRole.PAYEE), neutral(partyId, PartyRole.INTERMEDIARY)],
    [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ORIGINATES }, context(contextId)],
    ReasonType.COMMISSION_ACCRUAL,
  );

const received = (objectId: string, partyId: string, amount: string, contextId: string, originId: string) =>
  event(
    EventType.COMMISSION_RECEIVED,
    EconomicEffect.CASH_IN,
    amount,
    [
      { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount },
      neutral(OPERATOR, PartyRole.PAYER),
      neutral(partyId, PartyRole.INTERMEDIARY),
    ],
    [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }, context(contextId)],
    ReasonType.COMMISSION_PAYMENT,
    { relatedEventId: originId },
  );

const passOn = (objectId: string, partyId: string, amount: string, contextId?: string) =>
  event(
    EventType.COMMISSION_SPLIT,
    EconomicEffect.CASH_OUT,
    amount,
    [{ partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount }, neutral(partyId, PartyRole.BENEFICIARY)],
    [{ objectId, objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES }, ...inContext(contextId)],
    ReasonType.COMMISSION_SPLIT,
  );

const tax = (objectId: string, amount: string, brokerId?: string, contextId?: string) =>
  event(
    EventType.TAX_PAYMENT,
    EconomicEffect.CASH_OUT,
    amount,
    [
      { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount },
      neutral(TAX_AUTH, PartyRole.BENEFICIARY),
      ...(brokerId ? [neutral(brokerId, PartyRole.INTERMEDIARY)] : []),
    ],
    [{ objectId, objectType: ObjectType.TAX, relation: Relation.SETTLES }, ...inContext(contextId)],
    ReasonType.TAX_PAYMENT,
  );

const retraction = (objects: Cited[], amount: string, relatedEventId: string) =>
  event(
    EventType.LEDGER_CORRECTION,
    EconomicEffect.NON_CASH,
    amount,
    [neutral(USINA, PartyRole.PLATFORM)],
    objects,
    ReasonType.DATA_RECONCILIATION,
    { relatedEventId },
  );

/** The two-position event that already exists today: REQ-525 does not depend on compensation. */
const directPayment = (receivable: string, entitlement: string, amount: string, contextId?: string) =>
  event(
    EventType.DIRECT_PAYMENT_ACKNOWLEDGED,
    EconomicEffect.NON_CASH,
    amount,
    [neutral(JOAO, PartyRole.BENEFICIARY)],
    [
      { objectId: receivable, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
      { objectId: entitlement, objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES },
      ...inContext(contextId),
    ],
    ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED,
  );

const retracts = (objectId: string, objectType: ObjectType): Cited => ({
  objectId,
  objectType,
  relation: Relation.RETRACTS,
});

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────

interface Figures {
  cashIn: { toString(): string };
  cashOut: { toString(): string };
  net: { toString(): string };
  netNegative: boolean;
}
interface OpenPosition {
  objectId: string;
  openBalance: { toString(): string };
}
interface PartyFigures extends Figures {
  partyId: string;
  openPositions: OpenPosition[];
}
interface ResultReader {
  byParties(query: { partyIds: string[]; from?: Date; to?: Date }): Promise<{
    parties: PartyFigures[];
    unattributed: Figures;
    book: Figures;
  }>;
  byContext(contextId: string, period?: { from?: Date; to?: Date }): Promise<Figures & { openPositions: OpenPosition[] }>;
}

/** Loaded by path because the service does not exist yet; becomes a plain import when it does. */
async function results(repo: LedgerEventRepository): Promise<ResultReader> {
  const path = "../../../core/application/services/ResultService";
  const { ResultService } = await import(/* @vite-ignore */ path);
  return new ResultService(repo) as ResultReader;
}

const signed = (figures: Figures) => `${figures.netNegative ? "-" : ""}${figures.net.toString()}`;

async function open(repo: LedgerEventRepository, objectId: string) {
  const summary = await new PositionProjectionService(repo).summarize(objectId);
  return summary?.openBalance?.toString();
}

async function outcome(repo: LedgerEventRepository, objectId: string) {
  return (await new PositionProjectionService(repo).summarize(objectId))?.outcome as string;
}

async function bookCash(repo: LedgerEventRepository) {
  const statement = await new CashStatementService(repo, USINA).summarize(new Date("2020-01-01"), new Date("2030-01-01"));
  return `${statement.closingBalanceNegative ? "-" : ""}${statement.closingBalance.toString()}`;
}

const REFUSED_OVER_BALANCE = /conservation|exceed|over-?settle/i;
const REFUSED_NOT_BOTH_SIDES = /at least one receivable and one payable/i;
const REFUSED_PARTIAL_RETRACTION = /every position/i;

// ── §4.5 Compensação ──────────────────────────────────────────────────────────────────────────────

describe("REQ-250 — compensação é um único evento", () => {
  it("CA-250: 300,00 reduz adiantamento e obrigação, sem mexer no caixa", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-250", JOAO, "300.00"));
    await run(obligation("cp-250", JOAO, "600.00"));
    const before = await bookCash(ledgerRepo);

    await run(compensation("300.00", [JOAO], [["adv-250", ObjectType.ADVANCE], ["cp-250", ObjectType.COMMISSION_PAYABLE]]));

    expect(await open(ledgerRepo, "adv-250")).toBe("0.00");
    expect(await open(ledgerRepo, "cp-250")).toBe("300.00");
    expect(await bookCash(ledgerRepo)).toBe(before);
  });

  // Passes before the compensation type exists because the over-settlement guard runs first; CA-250
  // below is what proves a compensation that fits is accepted.
  it("CA-250b / REJ-250: valor que não cabe em um dos lados é recusado inteiro", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-250b", JOAO, "300.00"));
    await run(obligation("cp-250b", JOAO, "200.00"));

    await expect(
      run(compensation("300.00", [JOAO], [["adv-250b", ObjectType.ADVANCE], ["cp-250b", ObjectType.COMMISSION_PAYABLE]])),
    ).rejects.toThrow(REFUSED_OVER_BALANCE);

    expect(await open(ledgerRepo, "adv-250b")).toBe("300.00");
    expect(await open(ledgerRepo, "cp-250b")).toBe("200.00");
  });

  // "Mesmo valor" is the same amount on both sides, not the whole of either (decided 2026-11-11).
  it("CA-250c: compensação parcial de 100,00 deixa o resto aberto nos dois lados", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-250c", JOAO, "300.00"));
    await run(obligation("cp-250c", JOAO, "600.00"));
    const before = await bookCash(ledgerRepo);

    await run(compensation("100.00", [JOAO], [["adv-250c", ObjectType.ADVANCE], ["cp-250c", ObjectType.COMMISSION_PAYABLE]]));

    expect(await open(ledgerRepo, "adv-250c")).toBe("200.00");
    expect(await open(ledgerRepo, "cp-250c")).toBe("500.00");
    expect(await bookCash(ledgerRepo)).toBe(before);
  });

  it("a compensação aparece no ciclo das duas posições", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-cycle", JOAO, "300.00"));
    await run(obligation("cp-cycle", JOAO, "600.00"));
    const entry = await run(
      compensation("100.00", [JOAO], [["adv-cycle", ObjectType.ADVANCE], ["cp-cycle", ObjectType.COMMISSION_PAYABLE]]),
    );

    const projection = new PositionProjectionService(ledgerRepo);
    for (const objectId of ["adv-cycle", "cp-cycle"]) {
      const ids = (await projection.summarize(objectId))!.events.map((e) => e.id.value);
      expect(ids, objectId).toContain(entry.id.value);
    }
  });
});

describe("DEC-025 — tipos iniciais: adiantamento e empréstimo contra obrigação de comissão", () => {
  it("empréstimo contra obrigação de comissão é aceito", async () => {
    const { ledgerRepo, run } = setup();
    await run(loan("loan-025", JOAO, "500.00"));
    await run(obligation("cp-025", JOAO, "300.00"));

    await run(compensation("300.00", [JOAO], [["loan-025", ObjectType.LOAN], ["cp-025", ObjectType.COMMISSION_PAYABLE]]));

    expect(await open(ledgerRepo, "loan-025")).toBe("200.00");
    expect(await open(ledgerRepo, "cp-025")).toBe("0.00");
  });

  // Out of DEC-025 until a real case appears: the refusal names the type the contract does not take.
  it("REJ-025: adiantamento contra folha é recusado", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-025", JOAO, "300.00"));
    await run(payrollObligation("pr-025", JOAO, "300.00"));

    await expect(
      run(compensation("100.00", [JOAO], [["adv-025", ObjectType.ADVANCE], ["pr-025", ObjectType.PAYROLL]])),
    ).rejects.toThrow(/Object type payroll not allowed for event type compensation/);

    expect(await open(ledgerRepo, "adv-025")).toBe("300.00");
    expect(await open(ledgerRepo, "pr-025")).toBe("300.00");
  });
});

describe("REQ-251 — compensação cita um lado a receber e um a pagar", () => {
  const cases: [string, [string, ObjectType][]][] = [
    ["duas dívidas", [["cp-j", ObjectType.COMMISSION_PAYABLE], ["cp-m", ObjectType.COMMISSION_PAYABLE]]],
    ["dois créditos", [["adv-j", ObjectType.ADVANCE], ["adv-m", ObjectType.ADVANCE]]],
    ["uma posição só", [["adv-j", ObjectType.ADVANCE]]],
  ];

  it.each(cases)("REJ-251: %s", async (_label, positions) => {
    const { run } = setup();
    await run(advance("adv-j", JOAO, "300.00"));
    await run(advance("adv-m", MARIA, "300.00"));
    await run(obligation("cp-j", JOAO, "300.00"));
    await run(obligation("cp-m", MARIA, "300.00"));

    await expect(run(compensation("100.00", [JOAO], positions))).rejects.toThrow(REFUSED_NOT_BOTH_SIDES);
  });
});

describe("REQ-252 — o Ledger não julga quem são as pessoas", () => {
  it("adiantamento da Maria com dívida do João é aceito: é decisão do Treasury oferecer ou não", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-m252", MARIA, "300.00"));
    await run(obligation("cp-j252", JOAO, "300.00"));

    await run(
      compensation("100.00", [JOAO, MARIA], [["adv-m252", ObjectType.ADVANCE], ["cp-j252", ObjectType.COMMISSION_PAYABLE]]),
    );

    expect(await open(ledgerRepo, "adv-m252")).toBe("200.00");
    expect(await open(ledgerRepo, "cp-j252")).toBe("200.00");
  });
});

// ── §4.5 Obrigação de comissão ────────────────────────────────────────────────────────────────────

describe("REQ-253 e REQ-254 — obrigação de comissão", () => {
  it("CA-253: nasce sem caixa, com a Usina decidindo abri-la", async () => {
    const { ledgerRepo, run } = setup();

    await run(obligation("cp-253", JOAO, "600.00"));

    expect(await open(ledgerRepo, "cp-253")).toBe("600.00");
    expect(await bookCash(ledgerRepo)).toBe("0.00");
  });

  it("CA-254: em aberto, é o que a Usina deve, e não o que devem a ela", async () => {
    const { ledgerRepo, run } = setup();

    await run(obligation("cp-254", JOAO, "600.00"));

    const position = await new CashPositionService(ledgerRepo).summarize();
    expect(position.openPayables.toString()).toBe("600.00");
    expect(position.openReceivables.toString()).toBe("0.00");
  });
});

describe("REQ-258 — cada pessoa com direito tem a sua obrigação", () => {
  it("CA-258: corretor e supervisor têm posições separadas, e pagar fecha as duas", async () => {
    const { ledgerRepo, run } = setup();
    await run(obligation("cp-corretor", JOAO, "9.00", "prod-258"));
    await run(obligation("cp-supervisor", SUPERVISOR, "3.00", "prod-258"));

    expect(await open(ledgerRepo, "cp-corretor")).toBe("9.00");
    expect(await open(ledgerRepo, "cp-supervisor")).toBe("3.00");

    await run(passOn("cp-corretor", JOAO, "9.00", "prod-258"));
    await run(passOn("cp-supervisor", SUPERVISOR, "3.00", "prod-258"));

    expect(await open(ledgerRepo, "cp-corretor")).toBe("0.00");
    expect(await open(ledgerRepo, "cp-supervisor")).toBe("0.00");
  });

  pending("CA-258b: obrigação maior que o recebido é aceita, e o prejuízo fica exposto", async () => {
    const { ledgerRepo, run } = setup();
    const origin = await run(expected("rec-258b", JOAO, "30.00", "prod-258b"));
    await run(received("rec-258b", JOAO, "30.00", "prod-258b", origin.id.value));
    await run(obligation("cp-258b", JOAO, "40.00", "prod-258b"));
    await run(passOn("cp-258b", JOAO, "40.00", "prod-258b"));

    expect(signed(await (await results(ledgerRepo)).byContext("prod-258b"))).toBe("-10.00");
  });
});

// ── REQ-525 Retirada completa ─────────────────────────────────────────────────────────────────────

describe("REQ-525 — a retirada cita todas as posições do lançamento", () => {
  async function directPaymentOnRecord(contextId?: string) {
    const { ledgerRepo, run } = setup();
    await run(expected("rec-525", JOAO, "300.00", "prod-525"));
    const entry = await run(directPayment("rec-525", "ent-525", "300.00", contextId));
    return { ledgerRepo, run, entry };
  }

  it("citando as duas posições, a retirada é aceita e o lançamento deixa de contar", async () => {
    const { ledgerRepo, run, entry } = await directPaymentOnRecord();

    await run(
      retraction(
        [retracts("rec-525", ObjectType.COMMISSION_RECEIVABLE), retracts("ent-525", ObjectType.COMMISSION_ENTITLEMENT)],
        "300.00",
        entry.id.value,
      ),
    );

    expect(await open(ledgerRepo, "rec-525")).toBe("300.00");
    expect((await new PositionProjectionService(ledgerRepo).summarize("ent-525"))?.totalSettled.toString()).toBe("0.00");
  });

  it("o contexto citado no lançamento não precisa ser citado na retirada", async () => {
    const { ledgerRepo, run, entry } = await directPaymentOnRecord("prod-525");

    await run(
      retraction(
        [retracts("rec-525", ObjectType.COMMISSION_RECEIVABLE), retracts("ent-525", ObjectType.COMMISSION_ENTITLEMENT)],
        "300.00",
        entry.id.value,
      ),
    );

    expect(await open(ledgerRepo, "rec-525")).toBe("300.00");
  });

  it("REJ-525: citando só uma das posições, a retirada é recusada", async () => {
    const { ledgerRepo, run, entry } = await directPaymentOnRecord();

    await expect(
      run(retraction([retracts("rec-525", ObjectType.COMMISSION_RECEIVABLE)], "300.00", entry.id.value)),
    ).rejects.toThrow(REFUSED_PARTIAL_RETRACTION);

    expect(await open(ledgerRepo, "rec-525")).toBe("0.00");
  });

  it("CA-525: compensação retirada citando as duas posições devolve os dois saldos", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-525", JOAO, "300.00"));
    await run(obligation("cp-525", JOAO, "600.00"));
    const entry = await run(
      compensation("300.00", [JOAO], [["adv-525", ObjectType.ADVANCE], ["cp-525", ObjectType.COMMISSION_PAYABLE]]),
    );

    await run(
      retraction(
        [retracts("adv-525", ObjectType.ADVANCE), retracts("cp-525", ObjectType.COMMISSION_PAYABLE)],
        "300.00",
        entry.id.value,
      ),
    );

    expect(await open(ledgerRepo, "adv-525")).toBe("300.00");
    expect(await open(ledgerRepo, "cp-525")).toBe("600.00");
  });
});

// ── §4.4 Lote e §10 Confiança ─────────────────────────────────────────────────────────────────────

describe("REQ-246 — lote é um evento por pessoa, ligados pelo contexto", () => {
  const batch: Cited = { objectId: "lote-246", objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES };
  const paid = (position: string, partyId: string, amount: string) => {
    const payment = passOn(position, partyId, amount);
    return { ...payment, objects: [...payment.objects, batch] };
  };

  it("CA-246: dois eventos no mesmo lote fecham as duas obrigações e somam o débito no banco", async () => {
    const { ledgerRepo, run } = setup();
    await run(obligation("cp-j246", JOAO, "300.00"));
    await run(obligation("cp-m246", MARIA, "200.00"));

    await run(paid("cp-j246", JOAO, "300.00"));
    await run(paid("cp-m246", MARIA, "200.00"));

    expect(await open(ledgerRepo, "cp-j246")).toBe("0.00");
    expect(await open(ledgerRepo, "cp-m246")).toBe("0.00");
    expect(await bookCash(ledgerRepo)).toBe("-500.00");
    expect((await ledgerRepo.findByObjectId("lote-246")).map((e) => e.amount.toString())).toEqual(["300.00", "200.00"]);
  });

  it("REJ-246: um único evento com as duas posições conta o valor inteiro em cada uma", async () => {
    const { ledgerRepo, run } = setup();
    await run(obligation("cp-j246b", JOAO, "300.00"));
    await run(obligation("cp-m246b", MARIA, "200.00"));
    const single = passOn("cp-j246b", JOAO, "500.00");

    await expect(
      run({
        ...single,
        objects: [
          ...single.objects,
          { objectId: "cp-m246b", objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES },
        ],
      }),
    ).rejects.toThrow(REFUSED_OVER_BALANCE);
  });
});

describe("REQ-229 — comissão prevista pode ser esperada para o futuro", () => {
  it("aceita uma data esperada depois de hoje, sem mudar o saldo da posição", async () => {
    const { ledgerRepo, run } = setup();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const recorded = await run({ ...expected("rec-229", JOAO, "100.00", "prod-229"), dueAt: future });

    expect(recorded.dueAt).toEqual(future);
    expect(await open(ledgerRepo, "rec-229")).toBe("100.00");
  });
});

describe("REQ-806 — a confiança acompanha a forma como o fato ficou conhecido", () => {
  const withConfidence = (command: CreateLedgerEventCommand, confidence: ConfidenceLevel) => ({
    ...command,
    reason: { ...command.reason!, confidence },
  });

  it("CA-806: comissão recebida com confiança média é aceita", async () => {
    const { ledgerRepo, run } = setup();
    const origin = await run(expected("rec-806", JOAO, "100.00", "prod-806"));

    await run(withConfidence(received("rec-806", JOAO, "100.00", "prod-806", origin.id.value), ConfidenceLevel.MEDIUM));

    expect(await bookCash(ledgerRepo)).toBe("100.00");
  });

  it("REJ-323b: comissão recebida com confiança baixa é recusada, e o caixa não muda", async () => {
    const { ledgerRepo, run } = setup();
    const origin = await run(expected("rec-323", JOAO, "100.00", "prod-323"));

    await expect(
      run(withConfidence(received("rec-323", JOAO, "100.00", "prod-323", origin.id.value), ConfidenceLevel.LOW)),
    ).rejects.toThrow(/confidence/i);

    expect(await bookCash(ledgerRepo)).toBe("0.00");
  });
});

// ── §8.3 Resultado por parte e por contexto ───────────────────────────────────────────────────────

/** The three brokers of REQ-620. Every event names its broker, as REQ-625 asks when it is known. */
async function threeBrokers(run: ReturnType<typeof setup>["run"]) {
  for (const sale of ["a1", "a2"]) {
    const origin = await run(expected(`rec-${sale}`, CORRETOR_A, "1000.00", sale));
    await run(received(`rec-${sale}`, CORRETOR_A, "1000.00", sale, origin.id.value));
    await run(passOn(`cp-${sale}`, CORRETOR_A, "600.00", sale));
    await run(tax(`tax-${sale}`, "100.00", CORRETOR_A, sale));
  }

  await run(expected("rec-b1", CORRETOR_B, "500.00", "b1"));
  await run(expected("rec-b2", CORRETOR_B, "500.00", "b2"));
  await run(advance("adv-b", CORRETOR_B, "200.00"));
  const big = await run(expected("rec-b3", CORRETOR_B, "5000.00", "b3"));
  await run(received("rec-b3", CORRETOR_B, "5000.00", "b3", big.id.value));
  await run(passOn("cp-b3", CORRETOR_B, "3000.00", "b3"));
  await run(tax("tax-b3", "400.00", CORRETOR_B, "b3"));

  for (const sale of ["c1", "c2", "c3"]) {
    const origin = await run(expected(`rec-${sale}`, CORRETOR_C, "1000.00", sale));
    await run(received(`rec-${sale}`, CORRETOR_C, "1000.00", sale, origin.id.value));
    await run(passOn(`cp-${sale}`, CORRETOR_C, "900.00", sale));
    await run(tax(`tax-${sale}`, "150.00", CORRETOR_C, sale));
  }
}

const BROKERS = [CORRETOR_A, CORRETOR_B, CORRETOR_C];

describe("REQ-620 — resultado por parte", () => {
  pending("CA-620: corretores A, B e C aparecem pela aritmética, inclusive o negativo", async () => {
    const { ledgerRepo, run } = setup();
    await threeBrokers(run);

    const { parties } = await (await results(ledgerRepo)).byParties({ partyIds: BROKERS });
    const line = (id: string) => parties.find((p) => p.partyId === id)!;

    expect([line(CORRETOR_A).cashIn.toString(), line(CORRETOR_A).cashOut.toString(), signed(line(CORRETOR_A))]).toEqual([
      "2000.00",
      "1400.00",
      "600.00",
    ]);
    expect([line(CORRETOR_B).cashIn.toString(), line(CORRETOR_B).cashOut.toString(), signed(line(CORRETOR_B))]).toEqual([
      "5000.00",
      "3600.00",
      "1400.00",
    ]);
    expect([line(CORRETOR_C).cashIn.toString(), line(CORRETOR_C).cashOut.toString(), signed(line(CORRETOR_C))]).toEqual([
      "3000.00",
      "3150.00",
      "-150.00",
    ]);
  });

  pending("CA-620b: um evento retirado deixa de contar no total da parte", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-keep", JOAO, "100.00"));
    const wrong = await run(advance("adv-wrong", JOAO, "400.00"));
    await run(retraction([retracts("adv-wrong", ObjectType.ADVANCE)], "400.00", wrong.id.value));

    const { parties } = await (await results(ledgerRepo)).byParties({ partyIds: [JOAO] });

    expect(parties[0].cashOut.toString()).toBe("100.00");
  });

  pending("CA-620c: só contam os eventos ocorridos no período, por parte e por contexto", async () => {
    const { ledgerRepo, run } = setup();
    const march = new Date("2026-03-10T12:00:00.000Z");
    const may = new Date("2026-05-10T12:00:00.000Z");
    await run({ ...passOn("cp-mar", JOAO, "100.00", "prod-620c"), occurredAt: march });
    await run({ ...passOn("cp-may", JOAO, "250.00", "prod-620c"), occurredAt: may });
    const april = { from: new Date("2026-04-01T00:00:00.000Z"), to: new Date("2026-06-01T00:00:00.000Z") };

    const reader = await results(ledgerRepo);
    const { parties } = await reader.byParties({ partyIds: [JOAO], ...april });

    expect(parties[0].cashOut.toString()).toBe("250.00");
    expect((await reader.byContext("prod-620c", april)).cashOut.toString()).toBe("250.00");
  });
});

describe("REQ-621 — resultado por contexto, sem parar em zero", () => {
  const cases: [string, string, string, string][] = [
    ["lucro", "1000.00", "650.00", "350.00"],
    ["zero a zero", "600.00", "600.00", "0.00"],
    ["prejuízo", "600.00", "650.00", "-50.00"],
  ];

  pending.each(cases)("CA-621: %s", async (_label, cashIn, cashOut, net) => {
    const { ledgerRepo, run } = setup();
    const origin = await run(expected("rec-621", JOAO, cashIn, "prod-621"));
    await run(received("rec-621", JOAO, cashIn, "prod-621", origin.id.value));
    await run(passOn("cp-621", JOAO, cashOut, "prod-621"));

    const figures = await (await results(ledgerRepo)).byContext("prod-621");

    expect(figures.cashIn.toString()).toBe(cashIn);
    expect(figures.cashOut.toString()).toBe(cashOut);
    expect(signed(figures)).toBe(net);
  });

  pending("CA-621b: adiantamento sem produto conta no corretor, mas não no produto", async () => {
    const { ledgerRepo, run } = setup();
    const origin = await run(expected("rec-621b", JOAO, "1000.00", "prod-621b"));
    await run(advance("adv-621b", JOAO, "300.00"));
    await run(obligation("cp-621b", JOAO, "600.00", "prod-621b"));
    await run(
      compensation(
        "300.00",
        [JOAO],
        [["adv-621b", ObjectType.ADVANCE], ["cp-621b", ObjectType.COMMISSION_PAYABLE]],
        "prod-621b",
      ),
    );
    await run(received("rec-621b", JOAO, "1000.00", "prod-621b", origin.id.value));
    await run(passOn("cp-621b", JOAO, "300.00", "prod-621b"));

    const reader = await results(ledgerRepo);
    const { parties } = await reader.byParties({ partyIds: [JOAO] });

    expect(signed(parties[0])).toBe("400.00");
    expect(signed(await reader.byContext("prod-621b"))).toBe("700.00");
  });
});

describe("REQ-622 — resultado conhecido, junto com o que está aberto", () => {
  pending("CA-622: saldo positivo e obrigação aberta aparecem lado a lado", async () => {
    const { ledgerRepo, run } = setup();
    const origin = await run(expected("rec-622", JOAO, "1000.00", "prod-622"));
    await run(received("rec-622", JOAO, "1000.00", "prod-622", origin.id.value));
    await run(passOn("cp-622-paid", JOAO, "300.00", "prod-622"));
    await run(obligation("cp-622", JOAO, "200.00", "prod-622"));

    const reader = await results(ledgerRepo);
    const figures = await reader.byContext("prod-622");
    const { parties } = await reader.byParties({ partyIds: [JOAO] });

    expect(signed(figures)).toBe("700.00");
    expect(figures.openPositions.map((p) => [p.objectId, p.openBalance.toString()])).toContainEqual(["cp-622", "200.00"]);
    expect(parties[0].openPositions.map((p) => [p.objectId, p.openBalance.toString()])).toContainEqual(["cp-622", "200.00"]);
  });
});

describe("REQ-623 — o que não tem parte fica visível, sem rateio", () => {
  pending("CA-623 / REJ-623: partes mais não atribuído fecham com o caixa do caderno", async () => {
    const { ledgerRepo, run } = setup();
    await threeBrokers(run);
    await run(tax("tax-geral", "999.00"));

    const { parties, unattributed, book } = await (await results(ledgerRepo)).byParties({ partyIds: BROKERS });

    expect(parties.map(signed)).toEqual(["600.00", "1400.00", "-150.00"]);
    expect(signed(unattributed)).toBe("-999.00");
    expect(signed(book)).toBe("851.00");
    expect(await bookCash(ledgerRepo)).toBe("851.00");
  });
});

describe("REQ-624 — compensação não afirma ganho nem perda", () => {
  async function compensated(productPays: boolean) {
    const { ledgerRepo, run } = setup();
    const origin = await run(expected("rec-624", JOAO, "1000.00", "prod-624"));
    await run(advance("adv-624", JOAO, "300.00"));
    await run(obligation("cp-624", JOAO, "300.00", "prod-624"));
    await run(
      compensation("300.00", [JOAO], [["adv-624", ObjectType.ADVANCE], ["cp-624", ObjectType.COMMISSION_PAYABLE]], "prod-624"),
    );
    if (productPays) await run(received("rec-624", JOAO, "1000.00", "prod-624", origin.id.value));
    return ledgerRepo;
  }

  const cases: [string, boolean, string][] = [
    ["o produto paga", true, "700.00"],
    ["o produto nunca paga", false, "-300.00"],
  ];

  // Passo 5: the position closed by compensation asserts neither gain nor loss.
  it.each(cases)("CA-624 / REJ-624, posição: %s", async (_label, productPays) => {
    const ledgerRepo = await compensated(productPays);

    expect(await outcome(ledgerRepo, "adv-624")).toBe("compensated");
    expect(await outcome(ledgerRepo, "cp-624")).toBe("compensated");
  });

  // Passo 6: the gain or loss shows in the totals, never in the position.
  pending.each(cases)("CA-624, totais por parte: %s", async (_label, productPays, net) => {
    const ledgerRepo = await compensated(productPays);

    const { parties } = await (await results(ledgerRepo)).byParties({ partyIds: [JOAO] });
    expect(signed(parties[0])).toBe(net);
  });

  it("parte compensada e parte paga em dinheiro não vira perda", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-mix", JOAO, "300.00"));
    await run(obligation("cp-mix", JOAO, "600.00"));
    await run(compensation("300.00", [JOAO], [["adv-mix", ObjectType.ADVANCE], ["cp-mix", ObjectType.COMMISSION_PAYABLE]]));
    await run(passOn("cp-mix", JOAO, "300.00"));

    expect(await open(ledgerRepo, "cp-mix")).toBe("0.00");
    expect(await outcome(ledgerRepo, "cp-mix")).toBe("compensated");
  });

  // The cycle reads three figures side by side: in cash, compensated, written off (decided 2026-11-11).
  it("a posição mostra o compensado separado do dinheiro e da baixa", async () => {
    const { ledgerRepo, run } = setup();
    await run(advance("adv-fig", JOAO, "300.00"));
    await run(obligation("cp-fig", JOAO, "600.00"));
    await run(compensation("100.00", [JOAO], [["adv-fig", ObjectType.ADVANCE], ["cp-fig", ObjectType.COMMISSION_PAYABLE]]));

    const summary = (await new PositionProjectionService(ledgerRepo).summarize("adv-fig"))!;
    expect(summary.cashRecovered.toString()).toBe("0.00");
    expect((summary as unknown as { compensatedClosed: { toString(): string } }).compensatedClosed.toString()).toBe("100.00");
    expect(summary.nonCashClosed.toString()).toBe("0.00");
    expect(summary.openBalance?.toString()).toBe("200.00");
    expect(summary.outcome).toBe("pending");
  });

  // Decided 2026-11-11: what was compensated was recovered, without cash. A position with part
  // compensated and the rest written off is a partial loss, never a total one.
  it("compensado em parte e o resto baixado como perda → perda parcial", async () => {
    const { ledgerRepo, run } = setup();
    const origin = await run(advance("adv-loss", JOAO, "300.00"));
    await run(obligation("cp-loss", JOAO, "100.00"));
    await run(compensation("100.00", [JOAO], [["adv-loss", ObjectType.ADVANCE], ["cp-loss", ObjectType.COMMISSION_PAYABLE]]));
    await run(
      event(
        EventType.ADVANCE_SETTLEMENT,
        EconomicEffect.NON_CASH,
        "200.00",
        [neutral(USINA, PartyRole.PAYEE), neutral(JOAO, PartyRole.PAYER)],
        [{ objectId: "adv-loss", objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
        ReasonType.LOSS_RECOGNITION,
        { relatedEventId: origin.id.value },
      ),
    );

    expect(await open(ledgerRepo, "adv-loss")).toBe("0.00");
    expect(await outcome(ledgerRepo, "adv-loss")).toBe("partial_loss");
  });
});
