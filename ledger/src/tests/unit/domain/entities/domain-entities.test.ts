import { describe, expect, it } from "vitest";
import { LedgerEventParty } from "../../../../core/domain/entities/LedgerEventParty";
import { LedgerEventObject } from "../../../../core/domain/entities/LedgerEconomicObject";
import { Party } from "../../../../core/domain/entities/Party";
import { RejectedEvent } from "../../../../core/domain/entities/RejectedEvent";
import { Direction } from "../../../../core/domain/enums/Direction";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../../core/domain/enums/PartyRole";
import { PartyStatus } from "../../../../core/domain/enums/PartyStatus";
import { PartyType } from "../../../../core/domain/enums/PartyType";
import { Relation } from "../../../../core/domain/enums/Relation";
import { Money } from "../../../../core/domain/value-objects/Money";
import { ObjectId } from "../../../../core/domain/value-objects/ObjectId";
import { PartyId } from "../../../../core/domain/value-objects/PartyId";
import { RejectionReason } from "../../../../core/domain/value-objects/RejectionReason";
import { RejectionType } from "../../../../core/domain/value-objects/RejectionType";
import { StagingId } from "../../../../core/domain/value-objects/StagingId";

describe("LedgerEventParty", () => {
  it("stores all properties", () => {
    const amount = Money.fromDecimal("500.00", "BRL");
    const party = new LedgerEventParty(
      new PartyId("p-1"),
      PartyRole.PAYEE,
      Direction.IN,
      amount,
    );
    expect(party.partyId.value).toBe("p-1");
    expect(party.role).toBe(PartyRole.PAYEE);
    expect(party.direction).toBe(Direction.IN);
    expect(party.amount?.equals(amount)).toBe(true);
  });

  it("accepts null amount for NEUTRAL parties", () => {
    const party = new LedgerEventParty(
      new PartyId("p-2"),
      PartyRole.PLATFORM,
      Direction.NEUTRAL,
      null,
    );
    expect(party.amount).toBeNull();
    expect(party.direction).toBe(Direction.NEUTRAL);
  });
});

describe("LedgerEventObject", () => {
  it("stores all properties", () => {
    const obj = new LedgerEventObject(
      new ObjectId("obj-1"),
      ObjectType.COMMISSION_RECEIVABLE,
      Relation.SETTLES,
    );
    expect(obj.objectId.value).toBe("obj-1");
    expect(obj.objectType).toBe(ObjectType.COMMISSION_RECEIVABLE);
    expect(obj.relation).toBe(Relation.SETTLES);
  });
});

describe("Party", () => {
  it("stores mandatory fields", () => {
    const p = new Party(new PartyId("p-1"), PartyType.COMPANY, "Acme Corp");
    expect(p.id.value).toBe("p-1");
    expect(p.type).toBe(PartyType.COMPANY);
    expect(p.name).toBe("Acme Corp");
    expect(p.externalId).toBeUndefined();
    expect(p.status).toBeUndefined();
  });

  it("stores optional fields when provided", () => {
    const p = new Party(
      new PartyId("p-2"),
      PartyType.CLIENT,
      "Contoso Ltd",
      "ext-123",
      PartyStatus.ACTIVE,
    );
    expect(p.externalId).toBe("ext-123");
    expect(p.status).toBe(PartyStatus.ACTIVE);
  });
});

describe("RejectedEvent", () => {
  const makeReasons = () => [
    new RejectionReason(RejectionType.INVALID_AMOUNT, "Amount is negative"),
  ];

  it("creates with valid stagingId and reasons", () => {
    const event = RejectedEvent.create({
      stagingId: new StagingId("stg-001"),
      reasons: makeReasons(),
    });
    expect(event.stagingId.value).toBe("stg-001");
    expect(event.reasons).toHaveLength(1);
    expect(event.id).toBeDefined();
    expect(event.rejectedAt).toBeInstanceOf(Date);
  });

  it("assigns a unique UUID-like id", () => {
    const e1 = RejectedEvent.create({
      stagingId: new StagingId("stg-001"),
      reasons: makeReasons(),
    });
    const e2 = RejectedEvent.create({
      stagingId: new StagingId("stg-001"),
      reasons: makeReasons(),
    });
    expect(e1.id.value).not.toBe(e2.id.value);
  });

  it("throws when reasons array is empty", () => {
    expect(() =>
      RejectedEvent.create({
        stagingId: new StagingId("stg-001"),
        reasons: [],
      }),
    ).toThrow("At least one rejection reason is required");
  });

  it("stores rawPayload for audit", () => {
    const raw = { foo: "bar" };
    const event = RejectedEvent.create({
      stagingId: new StagingId("stg-001"),
      reasons: makeReasons(),
      rawPayload: raw,
    });
    expect(event.rawPayload).toEqual(raw);
  });
});

describe("RejectionReason", () => {
  it("stores type and description", () => {
    const r = new RejectionReason(
      RejectionType.MISSING_PARTY,
      "Party is missing",
    );
    expect(r.type).toBe(RejectionType.MISSING_PARTY);
    expect(r.description).toBe("Party is missing");
  });

  it("throws when description is empty", () => {
    expect(() => new RejectionReason(RejectionType.INVALID_SCHEMA, "")).toThrow(
      "Description is required",
    );
  });

  it("throws when description is whitespace only", () => {
    expect(() =>
      new RejectionReason(RejectionType.INVALID_SCHEMA, "   "),
    ).toThrow("Description is required");
  });
});
