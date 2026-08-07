import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  ALGEBRA_SNAPSHOT_PATH,
  ALGEBRA_SNAPSHOT_VERSION,
  buildAlgebraSnapshot,
  serializeAlgebraSnapshot,
} from "../../../infra/tools/export-algebra";
import { EVENT_CONTRACTS } from "../../../core/domain/contracts/EventContract";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * The snapshot is a projection of the algebra, not a second declaration of it — and this is what
 * makes that true rather than aspirational.
 *
 * A matrix widened without re-exporting would leave consumers deriving from yesterday's rules, and
 * the failure mode is the worst kind: everything keeps working, quietly, against the wrong answer.
 * Here it is a red test with an obvious fix.
 */
describe("algebra snapshot — freshness", () => {
  it("matches what the domain currently declares (run `npm run export:algebra`)", () => {
    const onDisk = readFileSync(ALGEBRA_SNAPSHOT_PATH, "utf8");
    expect(onDisk).toBe(serializeAlgebraSnapshot());
  });

  it("carries the shape version, so a consumer can refuse one it cannot read", () => {
    expect(buildAlgebraSnapshot().version).toBe(ALGEBRA_SNAPSHOT_VERSION);
  });
});

describe("algebra snapshot — completeness", () => {
  const snapshot = buildAlgebraSnapshot();

  it("holds every event type, because the contract registry is total", () => {
    expect(Object.keys(snapshot.contracts).sort()).toEqual(Object.values(EventType).sort());
    expect(Object.keys(snapshot.contracts)).toHaveLength(Object.keys(EVENT_CONTRACTS).length);
  });

  it("holds every object type's nature and admitted relations", () => {
    expect(Object.keys(snapshot.objectNature).sort()).toEqual(Object.values(ObjectType).sort());
    expect(Object.keys(snapshot.objectRelations).sort()).toEqual(Object.values(ObjectType).sort());
  });

  it("carries the flags a consumer branches on, as booleans rather than absences", () => {
    const correction = snapshot.contracts[EventType.LEDGER_CORRECTION];
    expect(correction.requiresPreviousHash).toBe(true);

    const received = snapshot.contracts[EventType.COMMISSION_RECEIVED];
    expect(received.requiresRelatedEventId).toBe(true);
    expect(received.allowedOriginTypes).toEqual([EventType.COMMISSION_EXPECTED]);

    // Absent in the source: published as false and [] so a consumer never has to tell "no" from
    // "not stated" — the snapshot answers, it does not shrug.
    const payroll = snapshot.contracts[EventType.PAYROLL_PAYMENT];
    expect(payroll.requiresRelatedEventId).toBe(false);
    expect(payroll.allowedOriginTypes).toEqual([]);
  });

  it("carries the work this project has already done to the algebra", () => {
    // The obligation-recognition reclassification: cost types became originable.
    expect(snapshot.objectRelations[ObjectType.PAYROLL]).toContain(Relation.ORIGINATES);
    expect(snapshot.contracts[EventType.OBLIGATION_RECOGNIZED].objects.map((o) => o.objectType))
      .toContain(ObjectType.PAYROLL);
  });

  it("is ordered deterministically, so a diff shows a change and not a reshuffle", () => {
    const keys = Object.keys(buildAlgebraSnapshot().contracts);
    expect(keys).toEqual([...keys].sort());
  });
});
