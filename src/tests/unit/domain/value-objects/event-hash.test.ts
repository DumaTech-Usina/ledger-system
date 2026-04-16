import { describe, expect, it } from "vitest";
import { EventHash } from "../../../../core/domain/value-objects/EventHash";

describe("EventHash", () => {
  describe("generateCanonical", () => {
    it("returns an EventHash with a non-empty hex string", () => {
      const hash = EventHash.generateCanonical({ id: "evt-001", amount: "100.00" });
      expect(hash).toBeInstanceOf(EventHash);
      expect(hash.value).toMatch(/^[a-f0-9]{64}$/);
    });

    it("is deterministic — same data produces same hash", () => {
      const data = { id: "evt-001", eventType: "COMMISSION_RECEIVED", amount: "100.00" };
      const hash1 = EventHash.generateCanonical(data);
      const hash2 = EventHash.generateCanonical(data);
      expect(hash1.value).toBe(hash2.value);
    });

    it("is key-order independent at top level", () => {
      // canonicalize sorts top-level keys, so insertion order should not matter
      const hash1 = EventHash.generateCanonical({ a: 1, b: 2 });
      const hash2 = EventHash.generateCanonical({ b: 2, a: 1 });
      expect(hash1.value).toBe(hash2.value);
    });

    it("produces different hashes for different data", () => {
      const hash1 = EventHash.generateCanonical({ id: "evt-001" });
      const hash2 = EventHash.generateCanonical({ id: "evt-002" });
      expect(hash1.value).not.toBe(hash2.value);
    });

    it("produces different hashes when a field value changes", () => {
      const hash1 = EventHash.generateCanonical({ amount: "100.00" });
      const hash2 = EventHash.generateCanonical({ amount: "200.00" });
      expect(hash1.value).not.toBe(hash2.value);
    });

    it("produces a 64-character SHA-256 hex digest", () => {
      const hash = EventHash.generateCanonical({ x: "test" });
      expect(hash.value).toHaveLength(64);
    });
  });

  describe("deduplication invariant (Critical)", () => {
    it("two events with identical canonical data have the same hash", () => {
      const payload = {
        id: "evt-001",
        eventType: "COMMISSION_RECEIVED",
        amount: "1000.00",
        currency: "BRL",
      };
      expect(EventHash.generateCanonical(payload).value).toBe(
        EventHash.generateCanonical({ ...payload }).value,
      );
    });

    it("different source references produce different hashes", () => {
      const base = { eventType: "COMMISSION_RECEIVED", amount: "1000.00" };
      expect(EventHash.generateCanonical({ ...base, ref: "A" }).value).not.toBe(
        EventHash.generateCanonical({ ...base, ref: "B" }).value,
      );
    });
  });
});
