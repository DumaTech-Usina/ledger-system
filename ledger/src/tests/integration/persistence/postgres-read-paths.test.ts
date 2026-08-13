import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { TypeOrmLedgerEventRepository } from "../../../infra/persistence/typeorm/TypeOrmLedgerEventRepository";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { LedgerEventModel } from "../../../infra/persistence/typeorm/models/LedgerEventModel";
import { LedgerEventPartyModel } from "../../../infra/persistence/typeorm/models/LedgerEventPartyModel";
import { LedgerEventObjectModel } from "../../../infra/persistence/typeorm/models/LedgerEventObjectModel";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { PositionAggregateOptions } from "../../../core/application/dtos/PositionAggregate";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { obligationRecognized, payrollPayment } from "../business-flows/helpers/commands/obligation-commands";
import { loanOrigination, loanRepayment } from "../business-flows/helpers/commands/loan-commands";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Direction } from "../../../core/domain/enums/Direction";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { SUPPLIER, TAX_AUTH, USINA, reporter } from "../business-flows/helpers/parties";
import { EventType } from "../../../core/domain/enums/EventType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { makeRef } from "../business-flows/helpers/ref";
import { InitialSchema1744848000000 } from "../../../infra/database/migrations/1744848000000-InitialSchema";
import { AddRelatedEventId1744934400000 } from "../../../infra/database/migrations/1744934400000-AddRelatedEventId";
import { AddTraceabilityIndexes1744934401000 } from "../../../infra/database/migrations/1744934401000-AddTraceabilityIndexes";
import { AddCommandId1744934402000 } from "../../../infra/database/migrations/1744934402000-AddCommandId";
import { AddDueAt1744934403000 } from "../../../infra/database/migrations/1744934403000-AddDueAt";
import { AddListingIndexes1744934404000 } from "../../../infra/database/migrations/1744934404000-AddListingIndexes";

/**
 * The read paths against a real Postgres.
 *
 * Everything else in this suite runs on the in-memory repository, which means the SQL — the more
 * complex of the two implementations, and the one holding the derivations that are written twice —
 * is exercised by nothing. These tests close that: for every filter, the two repositories are asked
 * the same question and must answer the same thing.
 *
 * Opt-in, because it needs a database: `LEDGER_PG_TEST=1 npm test`. Skipped otherwise, so the
 * default suite stays runnable anywhere. The connection details come from LEDGER_PG_* or default to
 * the docker-compose Postgres.
 */
const ENABLED = process.env.LEDGER_PG_TEST === "1";

const CONFIG = {
  host: process.env.LEDGER_PG_HOST ?? "localhost",
  port: Number(process.env.LEDGER_PG_PORT ?? 5432),
  username: process.env.LEDGER_PG_USER ?? "ledger",
  password: process.env.LEDGER_PG_PASSWORD ?? "ledger",
  database: process.env.LEDGER_PG_DATABASE ?? "ledger_test",
};

const ENTITIES = [LedgerEventModel, LedgerEventPartyModel, LedgerEventObjectModel];
const ref = makeRef();

/** The indexes the listing paths depend on. Declared in a migration; asserted to actually exist. */
const REQUIRED_INDEXES = [
  "IDX_ledger_events_recorded_at",
  "IDX_ledger_events_effect_occurred_at_id",
  "IDX_ledger_events_occurred_at_id",
  "IDX_ledger_event_objects_type_object_id",
  "IDX_ledger_event_objects_object_id_relation",
  "IDX_ledger_event_objects_event_id_relation",
  "IDX_ledger_event_parties_party_id_direction",
];

let ds: DataSource;
let sql: TypeOrmLedgerEventRepository;
let memory: InMemoryLedgerEventRepository;

/**
 * Records a fact in BOTH repositories, so the two hold the same book.
 *
 * The use case runs once, against Postgres, and the resulting event is copied into memory as it
 * stands. Running it twice would mint two different event ids for the same fact, and the second
 * book would then reject every settlement pointing at the first one's origin — the two books would
 * diverge before a single read was compared.
 */
async function run(command: CreateLedgerEventCommand) {
  const event = await new CreateLedgerEventUseCase(sql, new NoOpAuditLogger()).execute(command);
  await memory.save(event);
  return event;
}

/** Asks both the same question and returns the object ids each answered with. */
async function bothAnswer(options: PositionAggregateOptions) {
  const [fromSql, fromMemory] = await Promise.all([
    sql.findPositionAggregates({ limit: 200, ...options }),
    memory.findPositionAggregates({ limit: 200, ...options }),
  ]);
  return {
    sql: { ids: fromSql.data.map((d) => d.objectId), total: fromSql.total },
    memory: { ids: fromMemory.data.map((d) => d.objectId), total: fromMemory.total },
  };
}

/** Declares that a settlement never corresponded to the world. Depth 1, as the ledger approves. */
const retractLoanSettlement = (targetId: string): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-05-01"),
  amount: "100.00",
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("pg-retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId: targetId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId: "pg-retracted", objectType: ObjectType.LOAN, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: this entry never happened",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

describe.skipIf(!ENABLED)("Postgres read paths — SQL and memory answer the same book", () => {
  beforeAll(async () => {
    // The database itself is created outside any schema: a connection to `postgres` makes it, and
    // the failure is swallowed only when it already exists.
    const admin = new DataSource({ type: "postgres", ...CONFIG, database: "postgres", entities: [] });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${CONFIG.database}"`).catch(() => undefined);
    await admin.destroy();

    ds = new DataSource({
      type: "postgres",
      ...CONFIG,
      entities: ENTITIES,
      // Imported rather than globbed: TypeORM loads a glob with `require`, which fails on an ES
      // module under the test runner. The list is explicit, and a migration missing from it would
      // show up as a missing column or index in the very first test.
      migrations: [
        InitialSchema1744848000000,
        AddRelatedEventId1744934400000,
        AddTraceabilityIndexes1744934401000,
        AddCommandId1744934402000,
        AddDueAt1744934403000,
        AddListingIndexes1744934404000,
      ],
      migrationsRun: true,
      synchronize: false,
    });
    await ds.initialize();
    sql = new TypeOrmLedgerEventRepository(ds);
  }, 60_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query("TRUNCATE ledger_event_parties, ledger_event_objects, ledger_events");
    memory = new InMemoryLedgerEventRepository();
  });

  it("has every index the listing paths were written for", async () => {
    const rows: { indexname: string }[] = await ds.query(
      `SELECT indexname FROM pg_indexes WHERE tablename LIKE 'ledger\\_%'`,
    );
    const present = new Set(rows.map((r) => r.indexname));

    // An index declared only with @Index() on the model never reaches a schema built by migrations.
    // This is the guard for that: the decorator is not the statement, the migration is.
    for (const index of REQUIRED_INDEXES) {
      expect(present, `missing index ${index}`).toContain(index);
    }
  });

  it("answers the same for every filter the listing accepts", async () => {
    await run(obligationRecognized(ref, "pg-payroll-open", "1000.00"));
    const paid = await run(obligationRecognized(ref, "pg-payroll-paid", "500.00"));
    await run(
      payrollPayment(ref, "pg-payroll-paid", "500.00", {
        relatedEventId: paid.id.value,
        parties: [
          { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "500.00" },
          { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "500.00" },
        ],
      }),
    );
    const loan = await run(loanOrigination(ref, "pg-loan", "800.00"));
    await run(
      loanRepayment(ref, "pg-loan", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "300.00"),
    );

    const hour = 60 * 60 * 1000;
    const cases: Array<[string, PositionAggregateOptions]> = [
      ["no filter", {}],
      ["one type", { objectType: ObjectType.PAYROLL }],
      ["several types", { objectType: [ObjectType.PAYROLL, ObjectType.LOAN] }],
      ["one status", { status: "fully_settled" }],
      ["several statuses", { status: ["open", "partially_settled"] }],
      ["outcome", { outcome: "pending" }],
      ["period around now", { from: new Date(Date.now() - hour), to: new Date(Date.now() + hour) }],
      ["period ahead", { from: new Date(Date.now() + hour) }],
      ["party of the origination", { partyId: SUPPLIER }],
      ["party of the settlement only", { partyId: TAX_AUTH }],
      ["several parties", { partyId: [TAX_AUTH, SUPPLIER] }],
      ["type and party together", { objectType: ObjectType.PAYROLL, partyId: TAX_AUTH }],
      ["everything at once", {
        objectType: [ObjectType.PAYROLL],
        status: ["open", "partially_settled", "fully_settled"],
        partyId: [SUPPLIER],
        from: new Date(Date.now() - hour),
      }],
      ["sorted by dueAt", { sortBy: "dueAt", sortOrder: "ASC" }],
      ["page beyond the end", { page: 99, limit: 2 }],
    ];

    for (const [label, options] of cases) {
      const answers = await bothAnswer(options);
      expect([...answers.sql.ids].sort(), `${label}: ids`).toEqual([...answers.memory.ids].sort());
      expect(answers.sql.total, `${label}: total`).toBe(answers.memory.total);
    }
  });

  it("publishes the same parties from both, retracted events excluded", async () => {
    await run(obligationRecognized(ref, "pg-parties", "1000.00"));
    await run(
      payrollPayment(ref, "pg-parties", "400.00", {
        parties: [
          { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "400.00" },
          { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "400.00" },
        ],
      }),
    );

    const fromSql = await sql.findPositionAggregates({ limit: 10 });
    const fromMemory = await memory.findPositionAggregates({ limit: 10 });

    const parties = (page: typeof fromSql) => [...(page.data[0].parties ?? [])].sort();
    expect(parties(fromSql)).toEqual([SUPPLIER, TAX_AUTH, USINA].sort());
    expect(parties(fromSql)).toEqual(parties(fromMemory));
  });

  it("keeps a position whose type and period come from DIFFERENT events", async () => {
    // The regression the per-predicate semi-joins exist for. One event carries the type, another
    // carries the early recording; a single combined subquery would demand both from one row and
    // drop the position — leaving the page one row short, with nothing to report it.
    await run(obligationRecognized(ref, "pg-mixed", "1000.00"));
    await run(payrollPayment(ref, "pg-mixed", "100.00"));

    const answers = await bothAnswer({
      objectType: ObjectType.PAYROLL,
      to: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(answers.sql.ids).toContain("pg-mixed");
    expect(answers.sql.ids).toEqual(answers.memory.ids);
  });

  it("pages cash movements the same way in both, in both modes", async () => {
    for (let i = 0; i < 5; i++) {
      const loan = await run(loanOrigination(ref, `pg-mov-${i}`, "100.00"));
      await run(
        loanRepayment(ref, `pg-mov-${i}`, loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "50.00"),
      );
    }

    const ids = (page: { items: { id: { value: string } }[] }) => page.items.map((i) => i.id.value);

    const keysetSql = await sql.findCashMovementsPaginated({ limit: 3 });
    const keysetMemory = await memory.findCashMovementsPaginated({ limit: 3 });
    expect(ids(keysetSql)).toEqual(ids(keysetMemory));
    expect(keysetSql.total).toBeNull();
    expect(keysetSql.hasMore).toBe(true);

    const nextSql = await sql.findCashMovementsPaginated({ limit: 3, cursor: keysetSql.nextCursor! });
    const nextMemory = await memory.findCashMovementsPaginated({ limit: 3, cursor: keysetMemory.nextCursor! });
    expect(ids(nextSql)).toEqual(ids(nextMemory));

    const numberedSql = await sql.findCashMovementsPaginated({ limit: 3, page: 2 });
    const numberedMemory = await memory.findCashMovementsPaginated({ limit: 3, page: 2 });
    expect(ids(numberedSql)).toEqual(ids(numberedMemory));
    expect(numberedSql.total).toBe(numberedMemory.total);
    expect(numberedSql.totalPages).toBe(numberedMemory.totalPages);

    // Newest first by default, and the other direction on request — the same in both, and exactly
    // the reverse of each other over the same set.
    const ascSql = await sql.findCashMovementsPaginated({ limit: 10, sortOrder: "ASC" });
    const ascMemory = await memory.findCashMovementsPaginated({ limit: 10, sortOrder: "ASC" });
    const descSql = await sql.findCashMovementsPaginated({ limit: 10 });
    expect(ids(ascSql)).toEqual(ids(ascMemory));
    expect(ids(ascSql)).toEqual([...ids(descSql)].reverse());

    for (const options of [
      { limit: 10, effect: "cash_in" as const },
      { limit: 10, effect: "cash_out" as const },
      { limit: 10, partyId: USINA },
      { limit: 10, sortBy: "recordedAt" as const },
    ]) {
      const a = await sql.findCashMovementsPaginated(options);
      const b = await memory.findCashMovementsPaginated(options);
      expect(ids(a), JSON.stringify(options)).toEqual(ids(b));
    }
  });

  it("finds the settled objects of a set in one query, agreeing with memory", async () => {
    const loan = await run(loanOrigination(ref, "pg-settled", "100.00"));
    await run(
      loanRepayment(ref, "pg-settled", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "50.00"),
    );
    await run(loanOrigination(ref, "pg-untouched", "100.00"));

    // The settlement of this one was retracted: it closes nothing, and both readings must say so.
    const retractedLoan = await run(loanOrigination(ref, "pg-retracted", "100.00"));
    const undonePayment = await run(
      loanRepayment(ref, "pg-retracted", retractedLoan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "100.00"),
    );
    await run(retractLoanSettlement(undonePayment.id.value));

    const asked = ["pg-settled", "pg-untouched", "pg-retracted", "pg-unknown"];
    const fromSql = await sql.findSettledObjectIds(asked);
    const fromMemory = await memory.findSettledObjectIds(asked);

    expect([...fromSql]).toEqual(["pg-settled"]);
    expect([...fromSql]).toEqual([...fromMemory]);
  });
});
