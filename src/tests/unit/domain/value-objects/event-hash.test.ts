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
      const hash1 = EventHash.generateCanonical({ a: 1, b: 2 });
      const hash2 = EventHash.generateCanonical({ b: 2, a: 1 });
      expect(hash1.value).toBe(hash2.value);
    });

    it("is key-order independent for nested objects", () => {
      const hash1 = EventHash.generateCanonical({ source: { system: "normalizer", reference: "ref-001" } });
      const hash2 = EventHash.generateCanonical({ source: { reference: "ref-001", system: "normalizer" } });
      expect(hash1.value).toBe(hash2.value);
    });

    it("is key-order independent for objects inside arrays", () => {
      const hash1 = EventHash.generateCanonical({
        parties: [{ direction: "in", partyId: "p-1", role: "payee" }],
      });
      const hash2 = EventHash.generateCanonical({
        parties: [{ partyId: "p-1", role: "payee", direction: "in" }],
      });
      expect(hash1.value).toBe(hash2.value);
    });

    it("produces a stable hash for a realistic full event payload regardless of key insertion order", () => {
      const base = {
        id: "evt-001",
        eventType: "commission_received",
        economicEffect: "cash_in",
        occurredAt: "2024-02-15T00:00:00.000Z",
        amount: "1000.00",
        source: { system: "normalizer", reference: "ref-001" },
        normalization: { version: "1.0", workerId: "worker-1" },
        previousHash: null,
        parties: [{ partyId: "p-1", role: "payee", direction: "in", amount: "1000.00" }],
        objects: [{ objectId: "obj-1", objectType: "commission_receivable", relation: "settles" }],
        reason: { type: "commission_payment", description: "monthly", confidence: "high", requiresFollowup: false },
        reporter: { type: "system", id: "worker-1", channel: "job" },
      };

      // Same data, nested keys in different insertion order
      const shuffled = {
        reporter: { channel: "job", id: "worker-1", type: "system" },
        objects: [{ relation: "settles", objectType: "commission_receivable", objectId: "obj-1" }],
        parties: [{ amount: "1000.00", direction: "in", role: "payee", partyId: "p-1" }],
        previousHash: null,
        normalization: { workerId: "worker-1", version: "1.0" },
        source: { reference: "ref-001", system: "normalizer" },
        amount: "1000.00",
        occurredAt: "2024-02-15T00:00:00.000Z",
        economicEffect: "cash_in",
        eventType: "commission_received",
        id: "evt-001",
        reason: { requiresFollowup: false, confidence: "high", description: "monthly", type: "commission_payment" },
      };

      expect(EventHash.generateCanonical(base).value).toBe(EventHash.generateCanonical(shuffled).value);
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
