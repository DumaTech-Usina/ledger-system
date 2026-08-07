import { afterEach, describe, expect, it, vi } from "vitest";
import { EventHash } from "../../../../core/domain/value-objects/EventHash";
import { LedgerEvent } from "../../../../core/domain/entities/LedgerEvent";
import { makeValidProps } from "../../../fixtures";

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

  /**
   * The canonical form is the shape of the book's tamper evidence, and it is not free to drift.
   *
   * `canonicalize` sorts the key set, so ADDING a field changes the digest of every event recorded
   * afterwards — including events that leave the new field null. That is what happened when `dueAt`
   * was introduced (LedgerDueDateProposal.md §3, ratified option (a)): events stored before it keep
   * their hashes, because `reconstitute` never re-hashes, so the book carries two canonical forms
   * with a deploy as the boundary.
   *
   * That is a defensible one-off. What is not defensible is it happening again unnoticed, leaving a
   * chain nobody can verify because nobody wrote down where the boundaries are. These two tests are
   * the tripwire: the first pins the algorithm, the second pins the field set the event actually
   * hashes. A future field makes them red, and the red is the invitation to record the boundary.
   */
  describe("canonical form (pinned — a change here splits the chain)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("pins the digest of a fixed canonical payload — guards canonicalize() itself", () => {
      // Values are frozen; the assertion is the algorithm, not the data.
      const payload = {
        id: "evt-canonical-pin",
        amount: "1000.00",
        dueAt: null,
        occurredAt: "2024-02-15T00:00:00.000Z",
        objects: [{ objectId: "obj-1", objectType: "payable", relation: "originates" }],
      };

      expect(EventHash.generateCanonical(payload).value).toBe(
        "f8904f93357fe8f2d67f558d3ae00620ed82db588bc2bff7881cf4a7ac812ff1",
      );
    });

    it("pins the exact field set LedgerEvent.create hashes — a new field must be a deliberate act", () => {
      const spy = vi.spyOn(EventHash, "generateCanonical");

      LedgerEvent.create(makeValidProps());

      const hashed = spy.mock.calls[0][0] as Record<string, unknown>;

      expect(Object.keys(hashed).sort()).toEqual([
        "amount",
        "description",
        "dueAt",
        "economicEffect",
        "eventType",
        "id",
        "normalization",
        "objects",
        "occurredAt",
        "parties",
        "previousHash",
        "reason",
        "recordedAt",
        "relatedEventId",
        "reporter",
        "source",
        "sourceAt",
      ]);
    });

    it("an event that states a due date does not hash like one that leaves it unknown", () => {
      // The whole reason dueAt is inside the hash: otherwise these two would be indistinguishable,
      // and a due date could be moved after the fact without breaking anything.
      const withDue = EventHash.generateCanonical({ id: "e", dueAt: "2026-09-30T00:00:00.000Z" });
      const withoutDue = EventHash.generateCanonical({ id: "e", dueAt: null });

      expect(withDue.value).not.toBe(withoutDue.value);
    });
  });
});
