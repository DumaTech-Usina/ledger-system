import { beforeEach, describe, expect, it, vi, Mocked } from "vitest";
import { RejectLedgerEventUseCase } from "../../../core/application/use-cases/RejectLedgerEventUseCase";
import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { RejectedEvent } from "../../../core/domain/entities/RejectedEvent";
import { RejectionType } from "../../../core/domain/value-objects/RejectionType";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";

function makeMockRepo(): Mocked<RejectedEventRepository> {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 }),
  } as unknown as Mocked<RejectedEventRepository>;
}

describe("RejectLedgerEventUseCase", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let useCase: RejectLedgerEventUseCase;

  beforeEach(() => {
    repo = makeMockRepo();
    useCase = new RejectLedgerEventUseCase(repo, new NoOpAuditLogger());
  });

  // ============================
  // Happy path
  // ============================
  it("returns a RejectedEvent", async () => {
    const result = await useCase.execute({
      stagingId: "stg-001",
      reasons: [
        { type: RejectionType.INVALID_AMOUNT, description: "Bad amount" },
      ],
    });
    expect(result).toBeInstanceOf(RejectedEvent);
  });

  it("saves the rejected event to the repository", async () => {
    await useCase.execute({
      stagingId: "stg-001",
      reasons: [
        { type: RejectionType.INVALID_SCHEMA, description: "Missing field" },
      ],
    });
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.save).toHaveBeenCalledWith(expect.any(RejectedEvent));
  });

  it("preserves all rejection reasons", async () => {
    const result = await useCase.execute({
      stagingId: "stg-001",
      reasons: [
        { type: RejectionType.INVALID_AMOUNT, description: "Bad amount" },
        { type: RejectionType.MISSING_PARTY, description: "No party" },
      ],
    });
    expect(result.reasons).toHaveLength(2);
  });

  it("stores rawPayload when provided", async () => {
    const raw = { foo: "original-data" };
    const result = await useCase.execute({
      stagingId: "stg-001",
      reasons: [{ type: RejectionType.INVALID_SCHEMA, description: "Bad" }],
      rawPayload: raw,
    });
    expect(result.rawPayload).toEqual(raw);
  });

  // ============================
  // Domain invariant propagation
  // ============================
  it("throws when reasons list is empty", async () => {
    await expect(
      useCase.execute({ stagingId: "stg-001", reasons: [] }),
    ).rejects.toThrow("At least one rejection reason is required");
    expect(repo.save).not.toHaveBeenCalled();
  });

  // ============================
  // Invalid events always reach rejected repo (Critical)
  // ============================
  it("invalid events must reach the rejected repository", async () => {
    await useCase.execute({
      stagingId: "stg-bad",
      reasons: [{ type: RejectionType.DUPLICATE_EVENT, description: "Dup" }],
    });
    expect(repo.save).toHaveBeenCalled();
  });
});
