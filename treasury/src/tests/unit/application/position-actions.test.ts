import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { LedgerAlgebra, type LedgerAlgebraSnapshot } from "../../../core/application/services/LedgerAlgebra";
import { producibleTuples } from "../../../core/application/services/CandidateMapper";
import { ListPositionActionsUseCase } from "../../../core/application/use-cases/ListPositionActions";
import type { PositionLifecycle } from "../../../core/application/dtos/LedgerReadModels";
import type { PositionLifecyclePort } from "../../../core/application/ports/PositionLifecyclePort";

/**
 * Derived admissibility, against the REAL algebra the Ledger exports.
 *
 * A fixture snapshot would let these tests agree with a world that no longer exists, which is the
 * exact failure the export was built to end. The Ledger's own suite keeps the file fresh; this one
 * reads it.
 */
const snapshot = JSON.parse(
  readFileSync(join(__dirname, "../../../../../ledger/algebra.json"), "utf8"),
) as LedgerAlgebraSnapshot;

const algebra = new LedgerAlgebra(snapshot);

const position = (over: Partial<PositionLifecycle> = {}): PositionLifecycle => ({
  objectId: "intent:adv-1",
  objectType: "advance",
  status: "partially_settled",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "500.00",
  totalSettled: "200.00",
  openBalance: "300.00",
  eventCount: 2,
  events: [],
  ...over,
});

const listing = (lifecycle: PositionLifecycle | null) =>
  new ListPositionActionsUseCase(
    { lifecycle: async () => lifecycle } as unknown as PositionLifecyclePort,
    algebra,
  );

describe("LedgerAlgebra — the inversion", () => {
  it("answers what may touch a kind of position, read backwards from the contracts", () => {
    const actions = algebra.admissibleFor("advance");
    expect(actions).toContainEqual({ eventType: "advance_settlement", relation: "settles" });
    expect(actions).toContainEqual({ eventType: "advance_payment", relation: "originates" });
  });

  it("carries the reclassification this project made, without anyone restating it", () => {
    // A payroll became originable when OBLIGATION_RECOGNIZED was added. Nothing in treasury was
    // edited for this to be true here — the snapshot changed, and the inversion followed.
    expect(algebra.admissibleFor("payroll")).toContainEqual({
      eventType: "obligation_recognized",
      relation: "originates",
    });
  });

  it("does not claim to know whether an event touches other positions — the contract cannot say", () => {
    // OBLIGATION_RECOGNIZED lists five object types and names ONE; COMMISSION_SPLIT lists two and
    // names both. The contracts look identical here, so the algebra deliberately answers neither.
    const recognition = algebra.admissibleFor("payroll").find((a) => a.eventType === "obligation_recognized")!;
    expect(Object.keys(recognition).sort()).toEqual(["eventType", "relation"]);
  });

  it("tells an unknown kind apart from one that admits nothing", () => {
    expect(algebra.knows("advance")).toBe(true);
    expect(algebra.knows("not_a_type")).toBe(false);
    expect(algebra.admissibleFor("not_a_type")).toEqual([]);
  });

  it("refuses a snapshot shape it cannot read, instead of guessing at it", () => {
    expect(() => new LedgerAlgebra({ ...snapshot, version: 99 })).toThrow(/not readable/i);
  });

  it("says contextual objects have no lifecycle to evolve", () => {
    expect(algebra.isPositional("advance")).toBe(true);
    expect(algebra.isPositional("settlement_batch")).toBe(false);
  });
});

describe("producibleTuples — what treasury can actually record", () => {
  it("expands variants, because they offer different things to different positions", () => {
    const tuples = producibleTuples().filter((t) => t.scenarioId === "register_obligation_recognition");
    expect(tuples.map((t) => t.objectType).sort()).toEqual([
      "infrastructure_cost",
      "payable",
      "payroll",
      "service_fee",
      "tax",
    ]);
    expect(tuples.every((t) => t.relation === "originates")).toBe(true);
  });

  it("every tuple treasury can produce is one the Ledger admits", () => {
    // A scenario that maps to a tuple the algebra refuses is a defect that would only surface as a
    // rejection in production. Here it is a failing test.
    const illegal = producibleTuples().filter(
      (t) =>
        !algebra
          .admissibleFor(t.objectType)
          .some((a) => a.eventType === t.eventType && a.relation === t.relation),
    );
    expect(illegal).toEqual([]);
  });
});

describe("ListPositionActions", () => {
  it("offers what the algebra admits and treasury can produce, and nothing else", async () => {
    const result = (await listing(position()).execute("intent:adv-1"))!;

    expect(result.objectType).toBe("advance");
    expect(result.known).toBe(true);
    expect(result.actions.map((a) => a.scenarioId)).toContain("register_advance_settlement");
    // The Ledger admits a correction on an advance and treasury maps it.
    expect(result.actions.some((a) => a.relation === "retracts")).toBe(true);
    // Nothing about a commission can reach an advance.
    expect(result.actions.some((a) => a.eventType === "commission_received")).toBe(false);
  });

  it("ranks by relevance — and never removes", async () => {
    const settled = position({ openBalance: "0.00", totalSettled: "500.00", status: "fully_settled" });
    const result = (await listing(settled).execute("intent:adv-1"))!;

    const settle = result.actions.find((a) => a.scenarioId === "register_advance_settlement")!;
    expect(settle.likely).toBe(false);
    // Still offered: the operator may know a fact the book does not hold yet, and the Ledger is the
    // one that decides. Hiding it would leave them with a true fact and nowhere to put it.
    expect(settle).toBeDefined();
  });

  it("a position with nothing originated makes recording what established it the likely move", async () => {
    const paidPayroll = position({
      objectType: "payroll",
      totalOriginated: "0.00",
      totalSettled: "45000.00",
      openBalance: "0.00",
      status: "open",
    });

    const result = (await listing(paidPayroll).execute("payroll:1"))!;
    const recognise = result.actions.find((a) => a.scenarioId === "register_obligation_recognition")!;

    expect(recognise.likely).toBe(true);
    expect(result.actions[0].likely).toBe(true);
  });

  it("an unknown position kind is reported as unknown, not as forbidden", async () => {
    const strange = position({ objectType: "not_a_type" });
    const result = (await listing(strange).execute("x"))!;

    expect(result.known).toBe(false);
    expect(result.actions).toEqual([]);
  });

  it("a position the Ledger does not know yields nothing at all", async () => {
    expect(await listing(null).execute("ghost")).toBeNull();
  });
});

describe("touchesOtherPositions — answered by the producer, not the algebra", () => {
  it("a split emits a second object, so recording it reaches beyond this position", () => {
    const split = producibleTuples().find((t) => t.scenarioId === "register_commission_split");
    if (split) expect(split.touchesOtherPositions).toBe(true);

    const acknowledgement = producibleTuples().find((t) => t.scenarioId === "register_direct_payment")!;
    expect(acknowledgement.touchesOtherPositions).toBe(true);
  });

  it("a recognition names one of its five admitted kinds, so it touches nothing else", () => {
    const recognition = producibleTuples().filter(
      (t) => t.scenarioId === "register_obligation_recognition",
    );
    expect(recognition.every((t) => t.touchesOtherPositions === false)).toBe(true);
  });
});
