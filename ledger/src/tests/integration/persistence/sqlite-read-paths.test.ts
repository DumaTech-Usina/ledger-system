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
import { MIGRATIONS } from "../../../infra/database/data-source";

/**
 * The read paths against a real SQLite.
 *
 * Everything else in this suite runs on the in-memory repository, which means the SQL — the more
 * complex of the two implementations, and the one holding the derivations that are written twice —
 * is exercised by nothing. These tests close that: for every filter, the two repositories are asked
 * the same question and must answer the same thing.
 *
 * It used to need a Postgres server and was therefore opt-in, which meant the SQL was checked only
 * when someone remembered to check it. On SQLite the database is a file the test creates, so this
 * runs in the default suite on every commit — the migration to SQLite is worth little if the
 * queries it rewrote are only exercised by hand.
 */
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
 * The use case runs once, against SQLite, and the resulting event is copied into memory as it
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

describe("SQLite read paths — SQL and memory answer the same book", () => {
  beforeAll(async () => {
    ds = new DataSource({
      type: "better-sqlite3",
      // In memory: the schema comes from the same migration production runs, so what is checked is
      // the real DDL, but nothing is left on disk between runs.
      database: ":memory:",
      entities: ENTITIES,
      // The very migrations the service boots with — imported from the data source rather than
      // restated here, so a migration this suite never ran could not exist.
      migrations: MIGRATIONS,
      migrationsRun: true,
      synchronize: false,
      prepareDatabase: (db) => {
        db.pragma("foreign_keys = ON");
      },
    });
    await ds.initialize();
    sql = new TypeOrmLedgerEventRepository(ds);
  }, 60_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    // SQLite has no TRUNCATE. The children go first even though the FK cascades — an explicit
    // order says what is being emptied instead of relying on a pragma being on.
    await ds.query("DELETE FROM ledger_event_parties");
    await ds.query("DELETE FROM ledger_event_objects");
    await ds.query("DELETE FROM ledger_events");
    memory = new InMemoryLedgerEventRepository();
  });

  it("has every index the listing paths were written for", async () => {
    const rows: { name: string }[] = await ds.query(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name LIKE 'ledger\\_%' ESCAPE '\\'`,
    );
    const present = new Set(rows.map((r) => r.name));

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

  /**
   * The aggregates the filter cases above never reach.
   *
   * Every one of them is a hand-written SQL statement that the port to SQLite rewrote — the money
   * columns now cross as text, `BOOL_OR` became a MAX over 0/1, and the instants are compared as
   * ISO strings rather than as timestamps. A rewrite of an aggregate that no test asks about is a
   * change to a number nobody is checking, so each is asked here beside the in-memory reading of
   * the same book.
   */
  describe("aggregates", () => {
    /** A book with one open position, one fully settled, one reversed, and a retracted settlement. */
    async function seedMixedBook() {
      await run(obligationRecognized(ref, "agg-open", "1000.00"));

      const settled = await run(obligationRecognized(ref, "agg-settled", "500.00"));
      await run(
        payrollPayment(ref, "agg-settled", "500.00", {
          relatedEventId: settled.id.value,
          parties: [
            { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "500.00" },
            { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "500.00" },
          ],
        }),
      );

      const loan = await run(loanOrigination(ref, "agg-loan", "800.00"));
      await run(
        loanRepayment(ref, "agg-loan", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "300.00"),
      );

      // A settlement that a rectification later declared never happened. Every aggregate must
      // exclude it, and the two readings must exclude it identically.
      const undone = await run(loanOrigination(ref, "agg-retracted", "100.00"));
      const undonePayment = await run(
        loanRepayment(ref, "agg-retracted", undone.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "100.00"),
      );
      await run(retractLoanSettlement(undonePayment.id.value));
    }

    it("totals cash in and out the same way", async () => {
      await seedMixedBook();
      expect(await sql.aggregateCashFlows()).toEqual(await memory.aggregateCashFlows());
    });

    it("totals cash before a date the same way", async () => {
      await seedMixedBook();
      const ahead = new Date(Date.now() + 60 * 60 * 1000);
      expect(await sql.aggregateCashFlowsBefore(ahead)).toEqual(
        await memory.aggregateCashFlowsBefore(ahead),
      );
      // Before the book existed: nothing counted, and "nothing" must be zero from both.
      const behind = new Date("2000-01-01");
      expect(await sql.aggregateCashFlowsBefore(behind)).toEqual(
        await memory.aggregateCashFlowsBefore(behind),
      );
    });

    it("sums the open balance per object type the same way", async () => {
      await seedMixedBook();
      const sort = (rows: Awaited<ReturnType<typeof sql.aggregateOpenBalancesByObjectType>>) =>
        [...rows].sort((a, b) => a.objectType.localeCompare(b.objectType));
      expect(sort(await sql.aggregateOpenBalancesByObjectType())).toEqual(
        sort(await memory.aggregateOpenBalancesByObjectType()),
      );
    });

    it("reports closure stats over a period the same way", async () => {
      await seedMixedBook();
      const from = new Date("2000-01-01");
      const to = new Date(Date.now() + 60 * 60 * 1000);
      expect(await sql.aggregateClosureStats(from, to, "BRL")).toEqual(
        await memory.aggregateClosureStats(from, to, "BRL"),
      );
      // A currency the book never used closes nothing — not an error, and not a missing row.
      expect(await sql.aggregateClosureStats(from, to, "USD")).toEqual(
        await memory.aggregateClosureStats(from, to, "USD"),
      );
    });

    it("groups the period's cash flow by event type and effect the same way", async () => {
      await seedMixedBook();
      const key = (row: { eventType: string; economicEffect: string }) =>
        `${row.eventType}|${row.economicEffect}`;
      const sort = (rows: Awaited<ReturnType<typeof sql.aggregatePeriodCashFlow>>) =>
        [...rows].sort((a, b) => key(a).localeCompare(key(b)));
      const from = new Date("2000-01-01");
      const to = new Date(Date.now() + 60 * 60 * 1000);
      expect(sort(await sql.aggregatePeriodCashFlow(from, to))).toEqual(
        sort(await memory.aggregatePeriodCashFlow(from, to)),
      );
    });

    it("builds the unpaginated position aggregate the same way", async () => {
      await seedMixedBook();
      const strip = (rows: Awaited<ReturnType<typeof sql.findAllPositionAggregates>>) =>
        [...rows]
          .sort((a, b) => a.objectId.localeCompare(b.objectId))
          // `parties` is filled only by the paginated path; the unpaginated one leaves it unset,
          // and comparing an absent field against an absent field is what is meant here.
          .map(({ parties: _parties, ...rest }) => rest);
      expect(strip(await sql.findAllPositionAggregates())).toEqual(
        strip(await memory.findAllPositionAggregates()),
      );
    });

    it("walks the book by object, party and period the same way", async () => {
      await seedMixedBook();
      const ids = (events: { id: { value: string } }[]) => events.map((e) => e.id.value).sort();

      expect(ids(await sql.findByObjectId("agg-settled"))).toEqual(
        ids(await memory.findByObjectId("agg-settled")),
      );
      expect(ids(await sql.findByPartyId(TAX_AUTH))).toEqual(
        ids(await memory.findByPartyId(TAX_AUTH)),
      );

      const from = new Date("2000-01-01");
      const to = new Date(Date.now() + 60 * 60 * 1000);
      expect(ids(await sql.findByPeriod(from, to))).toEqual(ids(await memory.findByPeriod(from, to)));
      // A window the book falls entirely outside of: empty from both, not everything from one.
      expect(await sql.findByPeriod(new Date("1990-01-01"), new Date("1991-01-01"))).toEqual([]);

      expect([...(await sql.findAllObjectIds())].sort()).toEqual(
        [...(await memory.findAllObjectIds())].sort(),
      );
    });

    it("pages the event feed and reads the chain's head the same way", async () => {
      await seedMixedBook();
      const page = await sql.findPaginated({ page: 1, limit: 3, sortOrder: "ASC" });
      const memoryPage = await memory.findPaginated({ page: 1, limit: 3, sortOrder: "ASC" });

      // Exact order, not merely the same set. This book is written inside a single millisecond, so
      // every event here ties on `recorded_at` and the whole page is decided by the id tiebreaker —
      // which is precisely the case that used to be left to the engine.
      expect(page.data.map((e) => e.id.value)).toEqual(memoryPage.data.map((e) => e.id.value));
      expect(page.total).toBe(memoryPage.total);

      // Consecutive pages of one ordering, never two cuts of two different orderings: walking the
      // whole book page by page must yield each event once and all of them.
      const walked: string[] = [];
      for (let page = 1; page <= Math.ceil(memoryPage.total / 3); page++) {
        const next = await sql.findPaginated({ page, limit: 3, sortOrder: "ASC" });
        walked.push(...next.data.map((e) => e.id.value));
      }
      expect(new Set(walked).size).toBe(memoryPage.total);

      // The head of the hash chain — the value every new event links back to.
      const head = await sql.getLastEventHash();
      expect(head).not.toBeNull();
      expect(head!.value).toBe((await memory.getLastEventHash())!.value);
    });

    it("recovers an event through every lookup the writers use", async () => {
      const event = await run(obligationRecognized(ref, "agg-lookup", "1000.00"));

      // The round trip through SQLite must return the fact unchanged — this is where a timestamp
      // read back in the wrong zone, or a bigint rounded on the way out, would show up.
      const byId = await sql.getById(event.id.value);
      expect(byId).not.toBeNull();
      expect(byId!.occurredAt.toISOString()).toBe(event.occurredAt.toISOString());
      expect(byId!.recordedAt.toISOString()).toBe(event.recordedAt.toISOString());
      expect(byId!.amount.toUnits()).toBe(event.amount.toUnits());
      expect(byId!.hash.value).toBe(event.hash.value);
      expect(byId!.getParties().length).toBe(event.getParties().length);
      expect(byId!.getObjects().length).toBe(event.getObjects().length);

      expect((await sql.getByHash(event.hash.value))!.id.value).toBe(event.id.value);
      expect(await sql.existsBySourceReference(event.source.reference)).toBe(true);
      expect(await sql.existsBySourceReference("never-recorded")).toBe(false);
    });

    it("finds the same recent cash movements, in the same order", async () => {
      await seedMixedBook();
      const ids = (events: { id: { value: string } }[]) => events.map((e) => e.id.value);

      expect(ids(await sql.findRecentCashMovements(5))).toEqual(
        ids(await memory.findRecentCashMovements(5)),
      );

      // Below the number of movements in the book, so the limit itself falls on a tie: without the
      // tiebreaker, WHICH movements come back — not just their order — would be up to the engine.
      expect(ids(await sql.findRecentCashMovements(2))).toEqual(
        ids(await memory.findRecentCashMovements(2)),
      );

      // And the same answer every time it is asked.
      expect(ids(await sql.findRecentCashMovements(2))).toEqual(
        ids(await sql.findRecentCashMovements(2)),
      );
    });
  });
});
