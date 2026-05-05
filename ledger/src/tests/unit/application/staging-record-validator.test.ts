import { beforeEach, describe, expect, it, vi, Mocked } from "vitest";
import { StagingRecordValidator } from "../../../core/application/services/StagingRecordValidator";
import { RejectionType } from "../../../core/domain/value-objects/RejectionType";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { makeValidStagingRecord } from "../../fixtures";

// ============================
// Mock repository
// ============================
function makeMockLedgerRepo(
  existsResult = false,
): Mocked<LedgerEventRepository> {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    getLastEventHash: vi.fn().mockResolvedValue(null),
    existsBySourceReference: vi.fn().mockResolvedValue(existsResult),
    findAll: vi.fn().mockResolvedValue([]),
  } as unknown as Mocked<LedgerEventRepository>;
}

describe("StagingRecordValidator", () => {
  let repo: ReturnType<typeof makeMockLedgerRepo>;
  let validator: StagingRecordValidator;

  beforeEach(() => {
    repo = makeMockLedgerRepo();
    validator = new StagingRecordValidator(repo);
  });

  // ============================
  // Happy path
  // ============================
  describe("valid record", () => {
    it("returns no failures for a fully valid record", async () => {
      const failures = await validator.validate(makeValidStagingRecord());
      expect(failures).toHaveLength(0);
    });

    it("calls existsBySourceReference once", async () => {
      await validator.validate(makeValidStagingRecord());
      expect(repo.existsBySourceReference).toHaveBeenCalledOnce();
      expect(repo.existsBySourceReference).toHaveBeenCalledWith("ref-001");
    });
  });

  // ============================
  // Required field validation
  // ============================
  describe("missing required fields", () => {
    it.each([
      "eventType",
      "economicEffect",
      "occurredAt",
      "amount",
      "currency",
      "sourceReference",
      "normalizationVersion",
      "normalizationWorkerId",
    ] as const)("produces INVALID_SCHEMA when %s is absent", async (field) => {
      const record = makeValidStagingRecord({ [field]: undefined });
      const failures = await validator.validate(record);
      const types = failures.map((f) => f.type);
      expect(types).toContain(RejectionType.INVALID_SCHEMA);
      expect(failures.some((f) => f.description.includes(field))).toBe(true);
    });

    it("produces INVALID_SCHEMA when sourceSystem is absent", async () => {
      const record = makeValidStagingRecord({ sourceSystem: undefined });
      const failures = await validator.validate(record);
      expect(
        failures.some((f) => f.type === RejectionType.INVALID_SCHEMA),
      ).toBe(true);
    });

    it("produces INVALID_SCHEMA for unknown sourceSystem", async () => {
      const record = makeValidStagingRecord({ sourceSystem: "unknown-src" });
      const failures = await validator.validate(record);
      expect(
        failures.some((f) => f.type === RejectionType.INVALID_SCHEMA),
      ).toBe(true);
      expect(failures.some((f) => f.description.includes("unknown-src"))).toBe(
        true,
      );
    });

    it.each(["normalizer", "manual-import", "integration"])(
      "accepts known sourceSystem: %s",
      async (sourceSystem) => {
        const record = makeValidStagingRecord({ sourceSystem });
        const failures = await validator.validate(record);
        expect(
          failures.filter((f) => f.description.includes("source system")),
        ).toHaveLength(0);
      },
    );
  });

  // ============================
  // Reporter validation
  // ============================
  describe("reporter validation", () => {
    it("produces INVALID_SCHEMA when reporter is absent", async () => {
      const record = makeValidStagingRecord({ reporter: undefined });
      const failures = await validator.validate(record);
      expect(
        failures.some(
          (f) =>
            f.type === RejectionType.INVALID_SCHEMA &&
            f.description.includes("reporter"),
        ),
      ).toBe(true);
    });

    it("produces INVALID_SCHEMA when reporterType is missing", async () => {
      const record = makeValidStagingRecord({
        reporter: { reporterId: "r1", channel: "api" },
      });
      const failures = await validator.validate(record);
      expect(failures.some((f) => f.description.includes("reporter"))).toBe(
        true,
      );
    });
  });

  // ============================
  // Amount validation
  // ============================
  describe("amount format validation", () => {
    it("produces INVALID_AMOUNT for amount with 3 decimal places", async () => {
      const record = makeValidStagingRecord({ amount: "10.123" });
      const failures = await validator.validate(record);
      expect(
        failures.some((f) => f.type === RejectionType.INVALID_AMOUNT),
      ).toBe(true);
    });

    it("produces INVALID_AMOUNT for negative amount", async () => {
      const record = makeValidStagingRecord({ amount: "-100" });
      const failures = await validator.validate(record);
      expect(
        failures.some((f) => f.type === RejectionType.INVALID_AMOUNT),
      ).toBe(true);
    });

    it("produces INVALID_AMOUNT for non-numeric amount", async () => {
      const record = makeValidStagingRecord({ amount: "abc" });
      const failures = await validator.validate(record);
      expect(
        failures.some((f) => f.type === RejectionType.INVALID_AMOUNT),
      ).toBe(true);
    });

    it("accepts valid amount formats", async () => {
      for (const amount of ["100", "100.5", "100.50"]) {
        const record = makeValidStagingRecord({ amount });
        const failures = await validator.validate(record);
        expect(
          failures.filter((f) => f.type === RejectionType.INVALID_AMOUNT),
        ).toHaveLength(0);
      }
    });
  });

  // ============================
  // Party validation
  // ============================
  describe("party validation", () => {
    it("produces MISSING_PARTY when parties array is empty", async () => {
      const record = makeValidStagingRecord({ parties: [] });
      const failures = await validator.validate(record);
      expect(failures.some((f) => f.type === RejectionType.MISSING_PARTY)).toBe(
        true,
      );
    });

    it("produces MISSING_PARTY when parties is undefined", async () => {
      const record = makeValidStagingRecord({ parties: undefined });
      const failures = await validator.validate(record);
      expect(failures.some((f) => f.type === RejectionType.MISSING_PARTY)).toBe(
        true,
      );
    });

    it("produces MISSING_PARTY when a party is missing partyId", async () => {
      const record = makeValidStagingRecord({
        parties: [{ role: "PAYEE", direction: "IN" }],
      });
      const failures = await validator.validate(record);
      expect(
        failures.some(
          (f) =>
            f.type === RejectionType.MISSING_PARTY &&
            f.description.includes("partyId"),
        ),
      ).toBe(true);
    });

    it("produces MISSING_PARTY when a party is missing role", async () => {
      const record = makeValidStagingRecord({
        parties: [{ partyId: "p1", direction: "IN" }],
      });
      const failures = await validator.validate(record);
      expect(
        failures.some(
          (f) =>
            f.type === RejectionType.MISSING_PARTY &&
            f.description.includes("role"),
        ),
      ).toBe(true);
    });

    it("produces MISSING_PARTY when a party is missing direction", async () => {
      const record = makeValidStagingRecord({
        parties: [{ partyId: "p1", role: "PAYEE" }],
      });
      const failures = await validator.validate(record);
      expect(
        failures.some(
          (f) =>
            f.type === RejectionType.MISSING_PARTY &&
            f.description.includes("direction"),
        ),
      ).toBe(true);
    });
  });

  // ============================
  // Duplicate detection (Critical)
  // ============================
  describe("deduplication — DUPLICATE_EVENT", () => {
    it("produces DUPLICATE_EVENT when sourceReference already exists in ledger", async () => {
      repo = makeMockLedgerRepo(true); // exists = true
      validator = new StagingRecordValidator(repo);
      const record = makeValidStagingRecord();
      const failures = await validator.validate(record);
      expect(
        failures.some((f) => f.type === RejectionType.DUPLICATE_EVENT),
      ).toBe(true);
    });

    it("does not call existsBySourceReference when sourceReference is absent", async () => {
      const record = makeValidStagingRecord({ sourceReference: undefined });
      await validator.validate(record);
      expect(repo.existsBySourceReference).not.toHaveBeenCalled();
    });
  });

  // ============================
  // Multiple failures accumulate
  // ============================
  describe("failure accumulation", () => {
    it("accumulates multiple failures from a severely malformed record", async () => {
      const record = {
        id: "stg-bad",
        status: "pending" as const,
        // missing almost everything
        parties: [],
      };
      const failures = await validator.validate(record);
      expect(failures.length).toBeGreaterThan(3);
    });
  });
});
