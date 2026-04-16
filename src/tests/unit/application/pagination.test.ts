import { describe, expect, it } from "vitest";
import {
  normalizePageOptions,
  paginate,
  MAX_PAGE_LIMIT,
} from "../../../core/application/dtos/Pagination";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { InMemoryRejectedEventRepository } from "../../../infra/persistence/rejected/InMemoryRejectedEventRepository";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { makeValidProps, makeValidStagingRecord } from "../../fixtures";

// ============================
// normalizePageOptions
// ============================

describe("normalizePageOptions", () => {
  it("defaults to page 1 and limit 50 when given empty input", () => {
    const opts = normalizePageOptions({});
    expect(opts.page).toBe(1);
    expect(opts.limit).toBe(50);
  });

  it("accepts valid page and limit", () => {
    const opts = normalizePageOptions({ page: 3, limit: 20 });
    expect(opts.page).toBe(3);
    expect(opts.limit).toBe(20);
  });

  it("clamps page to minimum 1", () => {
    expect(normalizePageOptions({ page: 0 }).page).toBe(1);
    expect(normalizePageOptions({ page: -5 }).page).toBe(1);
  });

  it("clamps limit to minimum 1", () => {
    expect(normalizePageOptions({ limit: 0 }).limit).toBe(1);
    expect(normalizePageOptions({ limit: -10 }).limit).toBe(1);
  });

  it(`clamps limit to maximum ${MAX_PAGE_LIMIT}`, () => {
    expect(normalizePageOptions({ limit: 9999 }).limit).toBe(MAX_PAGE_LIMIT);
  });
});

// ============================
// paginate helper
// ============================

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1); // [1..25]

  it("returns first page correctly", () => {
    const result = paginate(items, { page: 1, limit: 10 });
    expect(result.data).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.total).toBe(25);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);
  });

  it("returns middle page correctly", () => {
    const result = paginate(items, { page: 2, limit: 10 });
    expect(result.data).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("returns last partial page correctly", () => {
    const result = paginate(items, { page: 3, limit: 10 });
    expect(result.data).toEqual([21, 22, 23, 24, 25]);
    expect(result.totalPages).toBe(3);
  });

  it("returns empty data array when page exceeds totalPages", () => {
    const result = paginate(items, { page: 99, limit: 10 });
    expect(result.data).toHaveLength(0);
  });

  it("handles empty items list", () => {
    const result = paginate([], { page: 1, limit: 10 });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1); // at least 1 page even when empty
  });

  it("returns all items when limit exceeds total", () => {
    const result = paginate(items, { page: 1, limit: 100 });
    expect(result.data).toHaveLength(25);
    expect(result.totalPages).toBe(1);
  });
});

// ============================
// InMemoryLedgerEventRepository.findPaginated
// ============================

describe("InMemoryLedgerEventRepository.findPaginated", () => {
  function seedRepo(count: number): InMemoryLedgerEventRepository {
    const repo = new InMemoryLedgerEventRepository();
    for (let i = 0; i < count; i++) {
      const event = LedgerEvent.create(
        makeValidProps({ source: { system: "normalizer", reference: `ref-${i}` } as any }),
      );
      repo.save(event);
    }
    return repo;
  }

  it("returns correct total for all stored events", async () => {
    const repo = seedRepo(15);
    const result = await repo.findPaginated({ page: 1, limit: 10 });
    expect(result.total).toBe(15);
    expect(result.totalPages).toBe(2);
  });

  it("returns first page of events", async () => {
    const repo = seedRepo(15);
    const result = await repo.findPaginated({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(10);
    expect(result.page).toBe(1);
  });

  it("returns second page of events", async () => {
    const repo = seedRepo(15);
    const result = await repo.findPaginated({ page: 2, limit: 10 });
    expect(result.data).toHaveLength(5);
    expect(result.page).toBe(2);
  });

  it("returns empty page when repo is empty", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const result = await repo.findPaginated({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });
});

// ============================
// InMemoryRejectedEventRepository.findPaginated
// ============================

describe("InMemoryRejectedEventRepository.findPaginated", () => {
  it("returns correct pagination metadata for rejected events", async () => {
    const repo = new InMemoryRejectedEventRepository();
    const { RejectedEvent } = await import(
      "../../../core/domain/entities/RejectedEvent"
    );
    const { StagingId } = await import(
      "../../../core/domain/value-objects/StagingId"
    );
    const { RejectionReason } = await import(
      "../../../core/domain/value-objects/RejectionReason"
    );
    const { RejectionType } = await import(
      "../../../core/domain/value-objects/RejectionType"
    );

    for (let i = 0; i < 7; i++) {
      await repo.save(
        RejectedEvent.create({
          stagingId: new StagingId(`stg-${i}`),
          reasons: [new RejectionReason(RejectionType.INVALID_SCHEMA, "test")],
        }),
      );
    }

    const result = await repo.findPaginated({ page: 1, limit: 5 });
    expect(result.total).toBe(7);
    expect(result.data).toHaveLength(5);
    expect(result.totalPages).toBe(2);

    const page2 = await repo.findPaginated({ page: 2, limit: 5 });
    expect(page2.data).toHaveLength(2);
  });
});

// ============================
// InMemoryStagingRepository.findPaginated
// ============================

describe("InMemoryStagingRepository.findPaginated", () => {
  it("returns paginated staging records", async () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      makeValidStagingRecord({ id: `stg-${i}`, sourceReference: `ref-${i}` }),
    );
    const repo = new InMemoryStagingRepository(records);

    const result = await repo.findPaginated({ page: 1, limit: 5 });
    expect(result.total).toBe(12);
    expect(result.data).toHaveLength(5);
    expect(result.totalPages).toBe(3);
  });

  it("returns last page with remaining records", async () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      makeValidStagingRecord({ id: `stg-${i}`, sourceReference: `ref-${i}` }),
    );
    const repo = new InMemoryStagingRepository(records);

    const result = await repo.findPaginated({ page: 3, limit: 5 });
    expect(result.data).toHaveLength(2);
    expect(result.page).toBe(3);
  });
});
