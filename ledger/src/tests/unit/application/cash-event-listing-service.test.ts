import { describe, it, expect } from "vitest";
import { CashEventListingService, CursorMismatchError } from "../../../core/application/services/CashEventListingService";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { makeExpectedCommand, makeValidCommand } from "../../fixtures";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { Direction } from "../../../core/domain/enums/Direction";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";

const USINA = "usina";
const OTHER_PARTY = "other-party-not-usina";

let _seq = 0;
const ref = () => `ref-cl-${++_seq}`;
const objId = () => `obj-cl-${++_seq}`;

function makeSvc(repo: InMemoryLedgerEventRepository) {
  return new CashEventListingService(repo);
}

async function createCashIn(
  repo: InMemoryLedgerEventRepository,
  occurredAt: Date,
  partyId = USINA,
  amount = "1000.00",
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  const parties = partyId === USINA
    ? [
        { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount },
        { partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL, amount },
      ]
    : [
        { partyId: partyId, role: PartyRole.PAYEE, direction: Direction.IN, amount },
      ];
  // NON_CASH ignition point — excluded from cash listings, but required for causality.
  const expected = await uc.execute(makeExpectedCommand({ sourceReference: ref(), amount }));
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    amount,
    relatedEventId: expected.id.value,
    objects: [{ objectId: objId(), objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }],
    parties,
    reason: { type: ReasonType.COMMISSION_PAYMENT, description: "comm", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

async function createNonCash(repo: InMemoryLedgerEventRepository, occurredAt: Date) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType: EventType.COMMISSION_WAIVER,
    economicEffect: EconomicEffect.NON_CASH,
    amount: "500.00",
    objects: [{ objectId: objId(), objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES }],
    parties: [{ partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
    reason: { type: ReasonType.COMMISSION_WAIVER, description: "waiver", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

/** A CASH_OUT movement, so the direction filter has both directions to tell apart. */
async function createCashOut(
  repo: InMemoryLedgerEventRepository,
  occurredAt: Date,
  partyId = USINA,
  amount = "700.00",
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType: EventType.LOAN_ORIGINATION,
    economicEffect: EconomicEffect.CASH_OUT,
    amount,
    objects: [{ objectId: objId(), objectType: ObjectType.LOAN, relation: Relation.ORIGINATES }],
    parties: [
      { partyId, role: PartyRole.PAYER, direction: Direction.OUT, amount },
      { partyId: "broker", role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount },
    ],
    reason: { type: ReasonType.LOAN_ORIGINATION, description: "loan", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

const T1 = new Date("2026-01-10T00:00:00Z");
const T2 = new Date("2026-02-10T00:00:00Z");
const T3 = new Date("2026-03-10T00:00:00Z");
const T4 = new Date("2026-04-10T00:00:00Z");

describe("CashEventListingService", () => {
  it("CL1 — no events: items = [], hasMore = false, nextCursor = null", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const page = await makeSvc(repo).list({ partyId: USINA, limit: 10 });

    expect(page.items).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("CL2 — CASH_IN event where Usina is party: appears in items", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1);

    const page = await makeSvc(repo).list({ partyId: USINA, limit: 10 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].effect).toBe("cash_in");
  });

  it("CL3 — NON_CASH event: not in items", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createNonCash(repo, T1);

    const page = await makeSvc(repo).list({ partyId: USINA, limit: 10 });

    expect(page.items).toHaveLength(0);
  });

  it("CL4 — per-call partyId: event where Usina is not a party is excluded; passing OTHER_PARTY returns it", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1, OTHER_PARTY);

    // Usina is not a party → excluded
    const pageUsina = await makeSvc(repo).list({ partyId: USINA, limit: 10 });
    expect(pageUsina.items).toHaveLength(0);

    // OTHER_PARTY is a party with direction=IN → included
    const pageOther = await makeSvc(repo).list({ partyId: OTHER_PARTY, limit: 10 });
    expect(pageOther.items).toHaveLength(1);
    expect(pageOther.items[0].effect).toBe("cash_in");
  });

  it("CL5 — period filter: only events in [from, to] appear", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1); // before period
    await createCashIn(repo, T2); // in period
    await createCashIn(repo, T3); // in period
    await createCashIn(repo, T4); // after period

    const from = new Date("2026-01-20T00:00:00Z");
    const to   = new Date("2026-03-31T00:00:00Z");
    const page = await makeSvc(repo).list({ partyId: USINA, from, to, limit: 10 });

    expect(page.items).toHaveLength(2);
    for (const item of page.items) {
      expect(item.occurredAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(item.occurredAt.getTime()).toBeLessThanOrEqual(to.getTime());
    }
  });

  it("CL6 — no period filter: all cash events across all time appear", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1);
    await createCashIn(repo, T2);
    await createCashIn(repo, T3);
    await createNonCash(repo, T4); // excluded

    const page = await makeSvc(repo).list({ partyId: USINA, limit: 10 });

    expect(page.items).toHaveLength(3);
  });

  it("CL7 — limit reached, more events exist: hasMore = true, nextCursor is non-null", async () => {
    const repo = new InMemoryLedgerEventRepository();
    for (let i = 0; i < 5; i++) {
      await createCashIn(repo, new Date(`2026-01-${10 + i}T00:00:00Z`));
    }

    const page = await makeSvc(repo).list({ partyId: USINA, limit: 3 });

    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it("CL8 — second call with nextCursor: returns next page, no overlap, newest first", async () => {
    const repo = new InMemoryLedgerEventRepository();
    for (let i = 0; i < 5; i++) {
      await createCashIn(repo, new Date(`2026-01-${10 + i}T00:00:00Z`));
    }

    const page1 = await makeSvc(repo).list({ partyId: USINA, limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.hasMore).toBe(true);

    const page2 = await makeSvc(repo).list({ partyId: USINA, limit: 3, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(2);
    expect(page2.hasMore).toBe(false);

    const ids1 = new Set(page1.items.map((i) => i.eventId));
    for (const item of page2.items) {
      expect(ids1.has(item.eventId)).toBe(false);
    }

    // The keyset walks in the ordering it was issued for — descending, the default.
    const allItems = [...page1.items, ...page2.items];
    for (let i = 1; i < allItems.length; i++) {
      expect(allItems[i].occurredAt.getTime()).toBeLessThanOrEqual(allItems[i - 1].occurredAt.getTime());
    }
  });

  it("CL9 — effect=cash_in returns only cash in; effect=cash_out only cash out", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1);
    await createCashOut(repo, T2);

    const inbound = await makeSvc(repo).list({ partyId: USINA, effect: "cash_in", limit: 10 });
    const outbound = await makeSvc(repo).list({ partyId: USINA, effect: "cash_out", limit: 10 });

    expect(inbound.items.map((i) => i.effect)).toEqual(["cash_in"]);
    expect(outbound.items.map((i) => i.effect)).toEqual(["cash_out"]);
  });

  it("CL10 — no effect: both directions, exactly as before the filter existed", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1);
    await createCashOut(repo, T2);

    const page = await makeSvc(repo).list({ partyId: USINA, limit: 10 });

    expect(page.items.map((i) => i.effect).sort()).toEqual(["cash_in", "cash_out"]);
  });

  it("CL11 — no partyId: the whole book's cash movements, not one party's statement", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1, USINA);
    await createCashIn(repo, T2, OTHER_PARTY);
    await createNonCash(repo, T3); // still excluded: it is not a cash movement

    const scoped = await makeSvc(repo).list({ partyId: USINA, limit: 10 });
    const whole  = await makeSvc(repo).list({ limit: 10 });

    expect(scoped.items).toHaveLength(1);
    expect(whole.items).toHaveLength(2);
  });

  it("CL13 — sortBy=recordedAt orders by entry in the book, not by when the fact happened", async () => {
    const repo = new InMemoryLedgerEventRepository();
    // Recorded in this order; T4 happened LAST but was written FIRST, which is exactly the case the
    // two axes disagree about — a fact recorded long after it occurred. The pause buys distinct
    // recording times: `recordedAt` is stamped with `new Date()`, so two events written inside the
    // same millisecond are genuinely tied and the id, not the axis, would decide the order.
    await createCashIn(repo, T4);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await createCashIn(repo, T1);

    const byOccurrence = await makeSvc(repo).list({ partyId: USINA, limit: 10 });
    const byRecording  = await makeSvc(repo).list({ partyId: USINA, limit: 10, sortBy: "recordedAt" });

    expect(byOccurrence.items.map((i) => i.occurredAt.getTime())).toEqual([T4.getTime(), T1.getTime()]);
    expect(byRecording.items.map((i) => i.occurredAt.getTime())).toEqual([T1.getTime(), T4.getTime()]);
  });

  it("CL14 — a numbered page carries total and totalPages; a keyset page carries neither", async () => {
    const repo = new InMemoryLedgerEventRepository();
    for (let i = 0; i < 5; i++) {
      await createCashIn(repo, new Date(`2026-01-${10 + i}T00:00:00Z`));
    }

    const numbered = await makeSvc(repo).list({ partyId: USINA, limit: 2, page: 2 });
    const keyset   = await makeSvc(repo).list({ partyId: USINA, limit: 2 });

    expect(numbered.items).toHaveLength(2);
    expect(numbered.total).toBe(5);
    expect(numbered.page).toBe(2);
    expect(numbered.totalPages).toBe(3);
    expect(numbered.hasMore).toBe(true);
    // A numbered page names no keyset position, and a keyset page counted nothing. Null in both
    // directions is the honest answer — never 0, which would state that the book holds none.
    expect(numbered.nextCursor).toBeNull();
    expect(keyset.total).toBeNull();
    expect(keyset.totalPages).toBeNull();
    expect(keyset.nextCursor).not.toBeNull();
  });

  it("CL15 — the last numbered page reports no more, and pages do not overlap", async () => {
    const repo = new InMemoryLedgerEventRepository();
    for (let i = 0; i < 5; i++) {
      await createCashIn(repo, new Date(`2026-01-${10 + i}T00:00:00Z`));
    }

    const page3 = await makeSvc(repo).list({ partyId: USINA, limit: 2, page: 3 });
    const page1 = await makeSvc(repo).list({ partyId: USINA, limit: 2, page: 1 });

    expect(page3.items).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
    const first = new Set(page1.items.map((i) => i.eventId));
    expect(page3.items.some((i) => first.has(i.eventId))).toBe(false);
  });

  it("CL16 — a cursor issued for one ordering is refused under another", async () => {
    const repo = new InMemoryLedgerEventRepository();
    for (let i = 0; i < 5; i++) {
      await createCashIn(repo, new Date(`2026-01-${10 + i}T00:00:00Z`));
    }

    const page1 = await makeSvc(repo).list({ partyId: USINA, limit: 2 });
    const cursor = page1.nextCursor!;

    // Replaying it under another ordering would silently skip or repeat rows — the one failure mode
    // a paged read cannot show on screen. It is refused instead.
    await expect(
      makeSvc(repo).list({ partyId: USINA, limit: 2, cursor, sortOrder: "ASC" }),
    ).rejects.toThrow(CursorMismatchError);
    await expect(
      makeSvc(repo).list({ partyId: USINA, limit: 2, cursor, sortBy: "recordedAt" }),
    ).rejects.toThrow(CursorMismatchError);

    // Same ordering: continues normally.
    const page2 = await makeSvc(repo).list({ partyId: USINA, limit: 2, cursor });
    expect(page2.items).toHaveLength(2);
  });

  it("CL17 — a cursor wins over a page number: it is the more specific statement", async () => {
    const repo = new InMemoryLedgerEventRepository();
    for (let i = 0; i < 5; i++) {
      await createCashIn(repo, new Date(`2026-01-${10 + i}T00:00:00Z`));
    }

    const page1 = await makeSvc(repo).list({ partyId: USINA, limit: 2 });
    const continued = await makeSvc(repo).list({
      partyId: USINA,
      limit: 2,
      cursor: page1.nextCursor!,
      page: 5,
    });

    expect(continued.total).toBeNull();
    expect(continued.items.map((i) => i.eventId)).not.toEqual(page1.items.map((i) => i.eventId));
  });

  it("CL12 — no partyId still honours period and effect", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, T1, OTHER_PARTY);
    await createCashIn(repo, T3, OTHER_PARTY);
    await createCashOut(repo, T3, OTHER_PARTY);

    const page = await makeSvc(repo).list({
      effect: "cash_in",
      from: new Date("2026-02-01T00:00:00Z"),
      limit: 10,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].effect).toBe("cash_in");
    expect(page.items[0].occurredAt.getTime()).toBe(T3.getTime());
  });
});
