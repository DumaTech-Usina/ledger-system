import { describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { TypeOrmLedgerEventRepository } from "../../../infra/persistence/typeorm/TypeOrmLedgerEventRepository";
import { ObjectType } from "../../../core/domain/enums/ObjectType";

/**
 * How the position aggregate is ASKED for — not what the database answers, which is what the
 * equivalence suite in tests/integration/persistence does.
 *
 * These fix the two properties that cost the most and are invisible from the outside: that reading
 * a page issues ONE aggregation rather than two, and that a filter narrows the set of objects
 * BEFORE the grouping instead of only after it. Both are easy to undo by accident while editing the
 * query, and neither shows up in a result-shape test.
 *
 * The exact predicates are asserted to survive alongside the pushed-down ones: the narrowing is a
 * superset, and dropping the exact twin would silently widen the answer.
 */
function repoWith(rows: Record<string, unknown>[]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const dataSource = {
    getRepository: () => ({
      manager: {
        query: async (sql: string, params: unknown[] = []) => {
          queries.push({ sql, params });
          // The fallback COUNT asks for a single row shaped { total }.
          if (/SELECT COUNT\(\*\) AS total/.test(sql)) return [{ total: "42" }];
          // The per-page parties lookup answers with its own shape.
          // SQLite's group_concat answers with one comma-joined string per group, not an array.
          if (/group_concat/.test(sql)) return [{ object_id: "obj-1", parties: "acme,party-usina" }];
          return rows;
        },
      },
    }),
  } as unknown as DataSource;
  return { repo: new TypeOrmLedgerEventRepository(dataSource), queries };
}

function aggregateRow(overrides: Record<string, unknown> = {}) {
  return {
    object_id: "obj-1",
    object_type: "loan",
    currency: "BRL",
    total_originated: "1000",
    total_settled: "0",
    total_adjusted: "0",
    cash_recovered: "0",
    non_cash_closed: "0",
    ref_cash_in: "0",
    ref_cash_out: "0",
    // SQLite has no boolean storage class: an aggregated flag comes back as 0 or 1.
    has_reversal: 0,
    has_unresolved_lineage: 0,
    event_count: "1",
    last_event_at: "2026-07-09T00:00:00.000Z",
    originated_at: null,
    created_at: "2026-07-09T00:00:00.000Z",
    due_at: null,
    total_rows: "7",
    ...overrides,
  };
}

describe("findPositionAggregates — how the book is asked", () => {
  it("reads a page with a single aggregation, carrying the total in the same pass", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);

    const page = await repo.findPositionAggregates({ page: 1, limit: 20 });

    // Exactly one query GROUPs the book. The second is the parties lookup, bounded by the page's
    // ids — never a join into the aggregate, which would repeat each event per party and inflate
    // every SUM with the size of the cast.
    const aggregations = queries.filter((q) => q.sql.includes("GROUP BY o.object_id") && !q.sql.includes("group_concat"));
    expect(aggregations).toHaveLength(1);
    expect(aggregations[0].sql).toContain("COUNT(*) OVER ()");
    expect(page.total).toBe(7);
    expect(page.totalPages).toBe(1);
    expect(page.data).toHaveLength(1);
    expect(page.data[0].parties).toEqual(["acme", "party-usina"]);
  });

  it("looks parties up for the page's ids only", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);

    await repo.findPositionAggregates({ page: 1, limit: 20 });
    const partiesQuery = queries.find((q) => q.sql.includes("group_concat"))!;

    expect(partiesQuery.params).toEqual(["obj-1"]);
    // Retracted events are excluded here too: a party that appears only on a retracted event took
    // part in nothing that still stands.
    expect(partiesQuery.sql).toContain("NOT EXISTS");
  });

  it("does not build a candidate set when nothing can narrow it", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);

    await repo.findPositionAggregates({});

    expect(queries[0].sql).not.toContain("candidates");
  });

  it("narrows by object type before the grouping, and still filters exactly after it", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);

    await repo.findPositionAggregates({ objectType: [ObjectType.PAYROLL, ObjectType.TAX] });
    const { sql, params } = queries[0];

    // Before: only the objects of those types are aggregated at all.
    expect(sql).toContain("co.object_type IN (?, ?)");
    expect(sql).toContain("o.object_id IN (");
    // After: the exact predicate still decides, because the narrowing is only a superset.
    expect(sql).toContain("object_type IN (?, ?)");
    // Bound TWICE — once per occurrence. `?` binds by position, so the value that narrows the
    // candidates and the value that filters the aggregate are two bindings of the same list.
    expect(params.slice(0, 4)).toEqual(["payroll", "tax", "payroll", "tax"]);
  });

  it("narrows with ONE semi-join PER predicate, never one row satisfying all of them", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);

    await repo.findPositionAggregates({
      objectType: [ObjectType.TAX],
      to: new Date("2026-02-01T00:00:00Z"),
    });
    const { sql } = queries[0];

    // Two independent subqueries. Combined into one, the SQL would demand a single event carrying
    // the type AND falling in the period — two facts that belong to the OBJECT, not to one of its
    // events. A position typed on one event and recorded early on another would vanish from a
    // listing it belongs in, and the page would simply be missing a row with nothing to report it.
    const subqueries = sql.split("o.object_id IN (").length - 1;
    expect(subqueries).toBe(2);
    expect(sql).toContain("co.object_type IN (?)");
    expect(sql).toContain("ce.recorded_at <= ?");
  });

  it("filters by party through an involvement semi-join, with no second pass after the grouping", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);

    await repo.findPositionAggregates({ partyId: ["acme", "banco-xpto"] });
    const { sql, params } = queries[0];

    expect(sql).toContain("JOIN ledger_event_parties cp ON cp.event_id = ce.id");
    expect(sql).toContain("cp.party_id IN (?, ?)");
    expect(params.slice(0, 2)).toEqual(["acme", "banco-xpto"]);
    // Involvement IS "some standing event names the party", which the semi-join states exactly —
    // so unlike type and period there is nothing left to re-check after the aggregation.
    const afterGrouping = sql.slice(sql.lastIndexOf("FROM aggs"));
    expect(afterGrouping).not.toContain("party_id");
  });

  it("narrows by period on the recording axis, both bounds", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-02-01T00:00:00Z");

    await repo.findPositionAggregates({ from, to });
    const { sql, params } = queries[0];

    expect(sql).toContain("ce.recorded_at >= ?");
    expect(sql).toContain("ce.recorded_at <= ?");
    expect(sql).toContain("created_at >= ?");
    expect(sql).toContain("created_at <= ?");
    // The CTE's bindings first, then the outer filter's, then the page — the order the statement
    // reads in. Instants cross as ISO-8601 UTC text, which is how they are stored.
    expect(params).toEqual([
      from.toISOString(), to.toISOString(),
      from.toISOString(), to.toISOString(),
      50, 0,
    ]);
  });

  it("keeps status and outcome after the grouping — they are functions of the sums", async () => {
    const { repo, queries } = repoWith([aggregateRow()]);

    await repo.findPositionAggregates({ status: ["open", "fully_settled"], outcome: "gain" });
    const { sql } = queries[0];

    expect(sql).not.toContain("candidates");
    expect(sql).toContain(" OR ");
    expect(sql).toContain("has_reversal");
  });

  it("an empty first page is a total of zero, without asking again", async () => {
    const { repo, queries } = repoWith([]);

    const page = await repo.findPositionAggregates({ page: 1 });

    expect(queries).toHaveLength(1);
    expect(page.total).toBe(0);
  });

  it("an empty page past the first asks for the count — unknown is not zero", async () => {
    const { repo, queries } = repoWith([]);

    const page = await repo.findPositionAggregates({ page: 9, limit: 20 });

    expect(queries).toHaveLength(2);
    expect(queries[1].sql).toContain("SELECT COUNT(*) AS total");
    expect(page.total).toBe(42);
  });
});

describe("findSettledObjectIds", () => {
  it("asks once for the whole set, never once per object", async () => {
    const { repo, queries } = repoWith([{ object_id: "a" }, { object_id: "c" }]);

    const settled = await repo.findSettledObjectIds(["a", "b", "c"]);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("relation = 'settles'");
    // A retracted settlement closes nothing, so the guard has to be here too — otherwise the event
    // feed reports a position closed while the projection reports it open, over the same book.
    expect(queries[0].sql).toContain("NOT EXISTS");
    expect(queries[0].params).toEqual(["a", "b", "c"]);
    expect([...settled].sort()).toEqual(["a", "c"]);
  });

  it("asks nothing when there is nothing to ask about", async () => {
    const { repo, queries } = repoWith([]);

    expect(await repo.findSettledObjectIds([])).toEqual(new Set());
    expect(queries).toHaveLength(0);
  });
});
