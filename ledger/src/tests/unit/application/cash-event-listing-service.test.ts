import { describe, it, expect } from "vitest";
import { CashEventListingService } from "../../../core/application/services/CashEventListingService";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { makeValidCommand } from "../../fixtures";
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
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    amount,
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

  it("CL8 — second call with nextCursor: returns next page, no overlap, ordered by occurredAt ASC", async () => {
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

    // Check ordering is ASC
    const allItems = [...page1.items, ...page2.items];
    for (let i = 1; i < allItems.length; i++) {
      expect(allItems[i].occurredAt.getTime()).toBeGreaterThanOrEqual(allItems[i - 1].occurredAt.getTime());
    }
  });
});
