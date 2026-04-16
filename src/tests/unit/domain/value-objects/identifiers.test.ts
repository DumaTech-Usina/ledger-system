import { describe, expect, it } from "vitest";
import { EventId } from "../../../../core/domain/value-objects/EventId";
import { PartyId } from "../../../../core/domain/value-objects/PartyId";
import { ObjectId } from "../../../../core/domain/value-objects/ObjectId";
import { StagingId } from "../../../../core/domain/value-objects/StagingId";
import { EventSource } from "../../../../core/domain/value-objects/EventSource";
import { NormalizationMetadata } from "../../../../core/domain/value-objects/NormalizationMetadata";

describe("EventId", () => {
  it("stores the value", () => {
    expect(new EventId("evt-123").value).toBe("evt-123");
  });

  it("throws when constructed with empty string", () => {
    expect(() => new EventId("")).toThrow("Invalid EventId");
  });
});

describe("PartyId", () => {
  it("stores the value", () => {
    expect(new PartyId("party-abc").value).toBe("party-abc");
  });
});

describe("ObjectId", () => {
  it("stores the value", () => {
    expect(new ObjectId("obj-xyz").value).toBe("obj-xyz");
  });
});

describe("StagingId", () => {
  it("stores the value", () => {
    expect(new StagingId("stg-001").value).toBe("stg-001");
  });

  it("throws when constructed with empty string", () => {
    expect(() => new StagingId("")).toThrow("StagingId is required");
  });

  it("throws when constructed with whitespace-only string", () => {
    expect(() => new StagingId("   ")).toThrow("StagingId is required");
  });
});

describe("Typed identifiers — not interchangeable (Critical)", () => {
  it("EventId and PartyId are different types", () => {
    const eventId = new EventId("shared-id");
    const partyId = new PartyId("shared-id");
    // Same value but different classes — TypeScript prevents accidental swapping
    expect(eventId).not.toBeInstanceOf(PartyId);
    expect(partyId).not.toBeInstanceOf(EventId);
  });

  it("ObjectId and PartyId are different types", () => {
    expect(new ObjectId("x")).not.toBeInstanceOf(PartyId);
  });

  it("StagingId and EventId are different types", () => {
    expect(new StagingId("x")).not.toBeInstanceOf(EventId);
  });
});

describe("EventSource", () => {
  it("stores system and reference", () => {
    const src = new EventSource("normalizer", "ref-001");
    expect(src.system).toBe("normalizer");
    expect(src.reference).toBe("ref-001");
  });

  it("throws when system is empty", () => {
    expect(() => new EventSource("", "ref-001")).toThrow("Source system required");
  });

  it("throws when reference is empty", () => {
    expect(() => new EventSource("normalizer", "")).toThrow(
      "Source reference required",
    );
  });
});

describe("NormalizationMetadata", () => {
  it("stores version and workerId", () => {
    const meta = new NormalizationMetadata("1.0", "worker-1");
    expect(meta.version).toBe("1.0");
    expect(meta.workerId).toBe("worker-1");
  });

  it("throws when version is empty", () => {
    expect(() => new NormalizationMetadata("", "worker-1")).toThrow(
      "Normalization version required",
    );
  });

  it("throws when workerId is empty", () => {
    expect(() => new NormalizationMetadata("1.0", "")).toThrow(
      "Worker id required",
    );
  });
});
