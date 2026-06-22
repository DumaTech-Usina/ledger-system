import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { commissionExpected, commissionReceived, commissionSplit, commissionWaiver, receivedFor } from "./helpers/commands/commission-commands";
import { USINA } from "./helpers/parties";
import { CashEventListingService } from "../../../core/application/services/CashEventListingService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReasonType } from "../../../core/domain/enums/ReasonType";

const ref = makeRef();

describe("CashEventListingService — integration", () => {
  it("CLI1 — loan originated + repaid: both CASH_OUT and CASH_IN movements appear; NON_CASH events absent", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashEventListingService(ledgerRepo);

    const loan = await run(loanOrigination(ref, "cli1-loan", "3000.00"));
    await run(loanRepayment(ref, "cli1-loan", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "3000.00"));

    // Add a NON_CASH event to ensure it is excluded
    await run(commissionWaiver(ref, "cli1-com-ent"));

    const page = await svc.list({ partyId: USINA, limit: 50 });

    expect(page.items).toHaveLength(2);
    const effects = page.items.map((i) => i.effect);
    expect(effects).toContain("cash_out");
    expect(effects).toContain("cash_in");
  });

  it("CLI2 — commission received then split: both movements in items, ordered by occurredAt", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashEventListingService(ledgerRepo);

    // commissionReceived at 2025-03-01, commissionSplit at 2025-03-02
    await receivedFor(run, ref, "cli2-com", "1000.00");
    await run(commissionSplit(ref, "cli2-split-pool", "700.00"));

    const page = await svc.list({ partyId: USINA, limit: 50 });

    expect(page.items).toHaveLength(2);
    expect(page.items[0].effect).toBe("cash_in");   // received first chronologically
    expect(page.items[1].effect).toBe("cash_out");  // split after

    // Ordered by occurredAt ASC
    expect(page.items[0].occurredAt.getTime()).toBeLessThanOrEqual(page.items[1].occurredAt.getTime());
  });

  it("CLI3 — period filter + cursor across pages: all pages cover exactly the period, no duplicates, no gaps", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashEventListingService(ledgerRepo);

    const periodFrom = new Date("2025-03-01T00:00:00Z");
    const periodTo   = new Date("2025-03-31T23:59:59Z");

    // Create 7 CASH_IN events in the period on different days
    for (let i = 0; i < 7; i++) {
      const day = 1 + i;
      const dateStr = `2025-03-${String(day).padStart(2, "0")}T12:00:00Z`;
      // ignition point (NON_CASH) is excluded from cash listings; only the received shows
      const expected = await run(commissionExpected(ref, `cli3-com-${i}`, "100.00"));
      await run({
        ...commissionReceived(ref, `cli3-com-${i}`, expected.id.value, "100.00"),
        occurredAt: new Date(dateStr),
      });
    }

    const collectedIds: string[] = [];
    let cursor: string | null | undefined;

    // Page 1
    const page1 = await svc.list({ partyId: USINA, from: periodFrom, to: periodTo, limit: 3 });
    for (const item of page1.items) collectedIds.push(item.eventId);
    cursor = page1.nextCursor;
    expect(page1.items).toHaveLength(3);
    expect(page1.hasMore).toBe(true);

    // Page 2
    const page2 = await svc.list({ partyId: USINA, from: periodFrom, to: periodTo, limit: 3, cursor: cursor! });
    for (const item of page2.items) collectedIds.push(item.eventId);
    cursor = page2.nextCursor;
    expect(page2.items).toHaveLength(3);
    expect(page2.hasMore).toBe(true);

    // Page 3 (remainder)
    const page3 = await svc.list({ partyId: USINA, from: periodFrom, to: periodTo, limit: 3, cursor: cursor! });
    for (const item of page3.items) collectedIds.push(item.eventId);
    expect(page3.hasMore).toBe(false);
    expect(page3.items).toHaveLength(1);

    // All 7, no duplicates
    expect(collectedIds).toHaveLength(7);
    expect(new Set(collectedIds).size).toBe(7);
  });

  it("CLI4 — CashPosition mode (no period, large dataset): all cash events returned across pages", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashEventListingService(ledgerRepo);

    // Create 10 cash events across wide date range
    for (let i = 0; i < 10; i++) {
      const year = 2020 + i;
      const expected = await run(commissionExpected(ref, `cli4-com-${i}`, "200.00"));
      await run({
        ...commissionReceived(ref, `cli4-com-${i}`, expected.id.value, "200.00"),
        occurredAt: new Date(`${year}-06-01T00:00:00Z`),
      });
    }

    // Add a NON_CASH event (should be excluded)
    await run(commissionWaiver(ref, "cli4-waiver-ent"));

    // Page through with limit=4 (no period filter)
    const allItems: string[] = [];
    let cursor: string | undefined;
    let iterations = 0;

    while (true) {
      const page = await svc.list({ partyId: USINA, limit: 4, cursor });
      for (const item of page.items) allItems.push(item.eventId);
      if (!page.hasMore) break;
      cursor = page.nextCursor!;
      iterations++;
      if (iterations > 10) break; // safety guard
    }

    expect(allItems).toHaveLength(10);
    expect(new Set(allItems).size).toBe(10);
  });
});
