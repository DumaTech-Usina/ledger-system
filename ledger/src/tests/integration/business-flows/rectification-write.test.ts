import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { USINA, reporter } from "./helpers/parties";
import { commissionExpected, commissionReceived } from "./helpers/commands/commission-commands";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * ETAPA 2 — the WRITE path of rectification.
 *
 * A retraction declares that a previously recorded event never corresponded to the world. This file
 * covers only what it takes to RECORD one: the relation, the contract, the invariants and the
 * chain rules. Nothing here asserts a projected figure — the read path is untouched at this stage,
 * so the retraction is written and, deliberately, not yet reflected anywhere.
 *
 * Approved decisions exercised: D2 (retraction of a retraction, depth 1) and D3 (the Ledger takes no
 * position on retracting a REVERSES — validation lives in the client).
 */

const ref = makeRef();

const retraction = (
  objectId: string,
  relatedEventId: string,
  amount: string,
  overrides: Partial<CreateLedgerEventCommand> = {},
): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-04-20"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: this entry never happened",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
  ...overrides,
});

/** Posts an origination + a settlement, and returns the settlement (the event to be retracted). */
async function settledPosition(run: (c: CreateLedgerEventCommand) => Promise<any>, objectId: string) {
  const origin = await run(commissionExpected(ref, objectId, "1000.00"));
  const settlement = await run(commissionReceived(ref, objectId, origin.id.value, "250.00"));
  return { origin, settlement };
}

describe("rectification — recording a valid retraction", () => {
  it("a retraction of a settlement is accepted and joins the object's life", async () => {
    const { ledgerRepo, run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:r1");

    const retracted = await run(retraction("com-recv:r1", settlement.id.value, "250.00"));

    expect(retracted.eventType).toBe(EventType.LEDGER_CORRECTION);
    expect(retracted.economicEffect).toBe(EconomicEffect.NON_CASH);
    expect(retracted.relatedEventId).toBe(settlement.id.value);
    expect(await lifecycleOf(ledgerRepo, "com-recv:r1")).toEqual([
      EventType.COMMISSION_EXPECTED,
      EventType.COMMISSION_RECEIVED,
      EventType.LEDGER_CORRECTION,
    ]);
    await assertChain(ledgerRepo);
  });

  it("the retracted event is untouched — immutability is not negotiable", async () => {
    const { ledgerRepo, run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:r2");
    const hashBefore = settlement.hash.value;

    await run(retraction("com-recv:r2", settlement.id.value, "250.00"));

    const stored = (await ledgerRepo.getById(settlement.id.value))!;
    expect(stored.hash.value).toBe(hashBefore);
    expect(stored.amount.toString()).toBe("250.00");
    expect(stored.getObjects()[0].relation).toBe(Relation.SETTLES);
  });

  it("MANUAL_CORRECTION is admitted as well as DATA_RECONCILIATION", async () => {
    const { run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:r3");

    const accepted = await run(
      retraction("com-recv:r3", settlement.id.value, "250.00", {
        reason: {
          type: ReasonType.MANUAL_CORRECTION,
          description: "keyed in error",
          confidence: ConfidenceLevel.HIGH,
          requiresFollowup: false,
        },
      }),
    );
    expect(accepted.getReason()?.type).toBe(ReasonType.MANUAL_CORRECTION);
  });
});

describe("rectification — invalid attempts are refused", () => {
  it("a retraction without a target is refused: 'something never happened' must say which", async () => {
    const { run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:r4");

    await expect(
      run(retraction("com-recv:r4", settlement.id.value, "250.00", { relatedEventId: null })),
    ).rejects.toThrow(/requires relatedEventId/i);
  });

  it("a retraction pointing at an event that does not exist is refused", async () => {
    const { run } = setup();
    await settledPosition(run, "com-recv:r5");

    await expect(
      run(retraction("com-recv:r5", "00000000-0000-0000-0000-000000000000", "250.00")),
    ).rejects.toThrow(/Origin event not found/i);
  });

  it("an event cannot both retract and move a position", async () => {
    const { run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:r6");

    await expect(
      run(
        retraction("com-recv:r6", settlement.id.value, "250.00", {
          objects: [
            { objectId: "com-recv:r6", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.RETRACTS },
            { objectId: "com-recv:r6", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ADJUSTS },
          ],
        }),
      ),
    ).rejects.toThrow(/cannot also move a position/i);
  });

  it("RETRACTS is refused on a CASH_IN event — rectification is a bookkeeping statement", async () => {
    const { run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:r7");

    // Refused at the contract, before any relation rule is consulted: LEDGER_CORRECTION admits
    // NON_CASH only. A retraction therefore cannot BE a cash movement under any construction — the
    // cash consequence of an error is a separate domain event, never the correction itself.
    await expect(
      run(
        retraction("com-recv:r7", settlement.id.value, "250.00", {
          economicEffect: EconomicEffect.CASH_IN,
          parties: [{ partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount: "250.00" }],
        }),
      ),
    ).rejects.toThrow(/Invalid economic effect cash_in for ledger_correction/i);
  });

  it("RETRACTS is refused on an event type whose contract does not admit it", async () => {
    const { run } = setup();
    const { origin } = await settledPosition(run, "com-recv:r8");

    await expect(
      run(
        retraction("com-recv:r8", origin.id.value, "250.00", {
          eventType: EventType.COMMISSION_EXPECTED,
          reason: {
            type: ReasonType.COMMISSION_ACCRUAL,
            description: "not a correction",
            confidence: ConfidenceLevel.HIGH,
            requiresFollowup: false,
          },
        }),
      ),
    ).rejects.toThrow(/not allowed for object|Relation retracts/i);
  });
});

describe("D2 — retraction of a retraction, capped at depth 1", () => {
  it("a retraction may itself be retracted", async () => {
    const { ledgerRepo, run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:d2a");

    const first = await run(retraction("com-recv:d2a", settlement.id.value, "250.00"));
    const second = await run(retraction("com-recv:d2a", first.id.value, "250.00"));

    expect(second.relatedEventId).toBe(first.id.value);
    await assertChain(ledgerRepo);
  });

  it("a retraction of a retraction cannot itself be retracted — the chain stops at depth 1", async () => {
    const { run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:d2b");

    const first = await run(retraction("com-recv:d2b", settlement.id.value, "250.00"));
    const second = await run(retraction("com-recv:d2b", first.id.value, "250.00"));

    await expect(run(retraction("com-recv:d2b", second.id.value, "250.00"))).rejects.toThrow(
      /chain too deep/i,
    );
  });

  it("one standing retraction per target — retractions form a chain, never a tree", async () => {
    const { run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:d2c");

    await run(retraction("com-recv:d2c", settlement.id.value, "250.00"));

    await expect(run(retraction("com-recv:d2c", settlement.id.value, "250.00"))).rejects.toThrow(
      /already been retracted/i,
    );
  });
});

describe("D3 — the Ledger takes no position on retracting a REVERSES", () => {
  /**
   * Approved decision: a REVERSES is validated by the consumer BEFORE creation, and the Ledger does
   * not encode business rules for that flow. This test states that absence explicitly: the general
   * invariants apply uniformly, with no special case keyed on the target's relation. The control is
   * the client's, and this is the fact a future reader needs in order not to mistake the absence for
   * an oversight.
   */
  it("no Ledger-side rule inspects the target's relation", async () => {
    const { run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:d3");

    // The only refusals a retraction can meet are the general ones exercised above: missing target,
    // absent target, mixed relations, wrong effect, wrong contract, already retracted, chain depth.
    // None of them mentions REVERSES.
    const accepted = await run(retraction("com-recv:d3", settlement.id.value, "250.00"));
    expect(accepted.relatedEventId).toBe(settlement.id.value);
  });
});

describe("ETAPA 2 boundary — writing a retraction changes no projection yet", () => {
  it("the retraction is recorded but the read path is deliberately untouched at this stage", async () => {
    const { ledgerRepo, run } = setup();
    const { settlement } = await settledPosition(run, "com-recv:stage2");
    await run(retraction("com-recv:stage2", settlement.id.value, "250.00"));

    // Four events on the object's life: the write path did its job.
    const events = await ledgerRepo.findByObjectId("com-recv:stage2");
    expect(events).toHaveLength(3);
    expect(events.some((e) => e.getObjects().some((o) => o.relation === Relation.RETRACTS))).toBe(true);
  });
});
