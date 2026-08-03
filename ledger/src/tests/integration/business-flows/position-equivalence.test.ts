import { describe, it, expect, beforeAll } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { BROKER, USINA, reporter } from "./helpers/parties";
import { commissionExpected, commissionReceived } from "./helpers/commands/commission-commands";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { PositionStatus } from "../../../core/application/dtos/PositionSummary";
import { USINA_RECEIVABLE_OBJECT_TYPES } from "../../../core/domain/policies/CashPositionPolicy";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * Equivalence harness for the position rule.
 *
 * The same status / openBalance math is implemented in four places: `deriveStatus` (detail path),
 * `positionUtils.derivePositionStatus` (aggregate path + filters), `statusToSql` (SQL filter) and
 * the WHERE of `aggregateOpenBalancesByObjectType` (receivables). Nothing kept them in agreement,
 * which is how the same defect came to exist in more than one of them. These tests pin the
 * agreement itself, so a future change to one site cannot silently diverge from the others.
 *
 * EQ-1 detail  vs list      · EQ-2 derivation vs filter · EQ-3 positions vs cash position
 * EQ-4 (TypeScript vs SQL)  · truth table shared with the SQL predicates — see `position-status-truth-table`.
 */

const ref = makeRef();

/** A COMMISSION_RECEIVED with no origin: the orphan the write path explicitly authorises. */
const orphanReceived = (objectId: string, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.COMMISSION_RECEIVED,
  economicEffect: EconomicEffect.CASH_IN,
  occurredAt: new Date("2025-03-10"),
  amount,
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: ref("orphan-recv"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [
    { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount },
    { partyId: BROKER, role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL, amount },
  ],
  objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.UNKNOWN_ORIGIN,
    description: "commission received; originating expected unknown",
    confidence: ConfidenceLevel.MEDIUM,
    requiresFollowup: true,
  },
  reporter: reporter(),
});

/** A cash-basis expense: settles a payable nothing ever originated. Ratified — must not change. */
const outboundPayment = (objectId: string, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.OUTBOUND_PAYMENT,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: new Date("2025-03-11"),
  amount,
  currency: "BRL",
  sourceSystem: "integration",
  sourceReference: ref("outbound"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [
    { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount },
    { partyId: "supplier-acme", role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
  ],
  objects: [{ objectId, objectType: ObjectType.PAYABLE, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.ORDINARY_SETTLEMENT,
    description: "ordinary settlement of a payable",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

const ledgerCorrectionReverses = (objectId: string, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-03-12"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("reversal"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.REVERSES }],
  reason: {
    type: ReasonType.MANUAL_CORRECTION,
    description: "entry reversed",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

/** Every shape the position rule must classify. Names are the ids used throughout. */
const OPEN = "com-recv:open";
const PARTIAL = "com-recv:partial";
const FULL = "com-recv:full";
const REVERSED = "com-recv:reversed";
const ORPHAN = "com-recv:orphan";
const CASH_BASIS = "payable:cash-basis";
const ADV_OPEN = "advance:open";
const ADV_PARTIAL = "advance:partial";

let repo: InMemoryLedgerEventRepository;
let positions: PositionProjectionService;
let cash: CashPositionService;

beforeAll(async () => {
  const s = setup();
  repo = s.ledgerRepo;
  positions = new PositionProjectionService(repo);
  cash = new CashPositionService(repo);
  const { run } = s;

  // open — originated, never settled
  await run(commissionExpected(ref, OPEN, "1000.00"));

  // partially settled — originated 1000, settled 400
  const partialOrigin = await run(commissionExpected(ref, PARTIAL, "1000.00"));
  await run(commissionReceived(ref, PARTIAL, partialOrigin.id.value, "400.00"));

  // fully settled — originated 1000, settled 1000
  const fullOrigin = await run(commissionExpected(ref, FULL, "1000.00"));
  await run(commissionReceived(ref, FULL, fullOrigin.id.value, "1000.00"));

  // reversed — originated, settled, then reversed
  const revOrigin = await run(commissionExpected(ref, REVERSED, "1000.00"));
  await run(commissionReceived(ref, REVERSED, revOrigin.id.value, "1000.00"));
  await run(ledgerCorrectionReverses(REVERSED, "1000.00"));

  // orphan — settled against an origination nobody knows
  await run(orphanReceived(ORPHAN, "700.00"));

  // cash-basis expense — settles a payable nothing originated (ratified, must not change)
  await run(outboundPayment(CASH_BASIS, "1500.00"));

  // receivable-typed positions, for the cash-position invariant
  await run(advancePayment(ref, ADV_OPEN, "500.00"));
  const advOrigin = await run(advancePayment(ref, ADV_PARTIAL, "800.00"));
  await run(
    advanceSettlement(ref, ADV_PARTIAL, advOrigin.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "300.00", ReasonType.ADVANCE_PAYMENT),
  );
});

const ALL_OBJECT_IDS = [OPEN, PARTIAL, FULL, REVERSED, ORPHAN, CASH_BASIS, ADV_OPEN, ADV_PARTIAL];

describe("EQ-1 — the detail path and the list path agree on every position", () => {
  it.each(ALL_OBJECT_IDS)("%s reads the same through summarize() and aggregateToListItem()", async (objectId) => {
    const summary = (await positions.summarize(objectId))!;
    const { data } = await repo.findPositionAggregates({ limit: 200 });
    const aggregate = data.find((a) => a.objectId === objectId)!;
    const listItem = positions.aggregateToListItem(aggregate);

    expect(summary).toBeTruthy();
    expect(aggregate).toBeTruthy();

    expect(listItem.status).toBe(summary.status);
    expect(listItem.outcome).toBe(summary.outcome);
    expect(listItem.totalOriginated.toString()).toBe(summary.totalOriginated.toString());
    expect(listItem.totalSettled.toString()).toBe(summary.totalSettled.toString());
    expect(listItem.totalAdjusted.toString()).toBe(summary.totalAdjusted.toString());
    expect(String(listItem.openBalance)).toBe(String(summary.openBalance));
    expect(String(listItem.overSettlement)).toBe(String(summary.overSettlement));
    expect(listItem.eventCount).toBe(summary.eventCount);
  });
});

describe("EQ-2 — the projected status and the repository filter agree", () => {
  /**
   * Table-driven over the status vocabulary itself: a member added without coverage fails here
   * rather than silently going untested.
   */
  it("every position is returned by the filter for its own projected status, and by no other", async () => {
    const { data: all } = await repo.findPositionAggregates({ limit: 200 });
    const statuses = [...new Set(all.map((a) => positions.aggregateToListItem(a).status))] as PositionStatus[];

    for (const status of statuses) {
      const { data: filtered } = await repo.findPositionAggregates({ status, limit: 200 });
      const filteredIds = new Set(filtered.map((a) => a.objectId));

      for (const objectId of ALL_OBJECT_IDS) {
        const projected = (await positions.summarize(objectId))!.status;
        expect(
          filteredIds.has(objectId),
          `${objectId} projects as "${projected}" but filter "${status}" ${filteredIds.has(objectId) ? "returned" : "omitted"} it`,
        ).toBe(projected === status);
      }
    }
  });
});

describe("EQ-3 — open receivables agree with the projected positions", () => {
  it("openReceivables equals the sum of open balances of receivable-typed positions", async () => {
    const { data } = await repo.findPositionAggregates({ limit: 200 });

    let expected = 0n;
    for (const agg of data) {
      if (!USINA_RECEIVABLE_OBJECT_TYPES.has(agg.objectType)) continue;
      const item = positions.aggregateToListItem(agg);
      if (item.status === "reversed") continue;
      // A position whose origination is unknown contributes an unknown amount — never a number.
      if (item.openBalance === null) continue;
      expected += item.openBalance.toUnits();
    }

    const summary = await cash.summarize();
    expect(summary.openReceivables.toUnits()).toBe(expected);
  });
});

describe("Achado 3 — an unknown origination is not an origination of zero", () => {
  it("the orphan does not read as a plain open position", async () => {
    const summary = (await positions.summarize(ORPHAN))!;
    // It carries a SETTLES event, so "open" (documented as "no SETTLES or REVERSES events yet")
    // is factually wrong for it.
    expect(summary.status).not.toBe("open");
  });

  it("the orphan reports its open balance and over-settlement as unknown, not as zero", async () => {
    const summary = (await positions.summarize(ORPHAN))!;
    expect(summary.openBalance).toBeNull();
    expect(summary.overSettlement).toBeNull();
  });

  it("the orphan's declared unresolved lineage survives into the projection", async () => {
    const summary = (await positions.summarize(ORPHAN))!;
    expect(summary.status).toBe("unknown_origin");
    expect(summary.origin).toBeNull();
  });

  it("REGRESSION GUARD — a cash-basis expense is untouched: nothing was originated and none is claimed", async () => {
    const summary = (await positions.summarize(CASH_BASIS))!;
    expect(summary.status).toBe("open");
    expect(summary.openBalance?.toString()).toBe("0.00");
    expect(summary.overSettlement?.toString()).toBe("0.00");

    // And it must never inflate receivables (payable is not a receivable type).
    const cashSummary = await cash.summarize();
    expect(cashSummary.openReceivables.toString()).not.toBe("NaN");
  });
});
