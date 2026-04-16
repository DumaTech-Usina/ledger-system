import { beforeEach, describe, expect, it, vi, Mocked } from "vitest";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { makeValidCommand, makeValidProps } from "../../fixtures";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";

function makeMockRepo(): Mocked<LedgerEventRepository> {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockResolvedValue(null),
    getByHash: vi.fn().mockResolvedValue(null),
    getByCommandId: vi.fn().mockResolvedValue(null),
    getLastEventHash: vi.fn().mockResolvedValue(null),
    existsBySourceReference: vi.fn().mockResolvedValue(false),
    findAll: vi.fn().mockResolvedValue([]),
    findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 }),
  } as unknown as Mocked<LedgerEventRepository>;
}

describe("CreateLedgerEventUseCase", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let useCase: CreateLedgerEventUseCase;

  beforeEach(() => {
    repo = makeMockRepo();
    useCase = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  });

  // ============================
  // Happy path
  // ============================
  describe("execute — valid command", () => {
    it("returns a LedgerEvent", async () => {
      const event = await useCase.execute(makeValidCommand());
      expect(event).toBeInstanceOf(LedgerEvent);
    });

    it("saves the event to the repository", async () => {
      await useCase.execute(makeValidCommand());
      expect(repo.save).toHaveBeenCalledOnce();
      expect(repo.save).toHaveBeenCalledWith(expect.any(LedgerEvent));
    });

    it("sets the correct eventType and economicEffect", async () => {
      const event = await useCase.execute(makeValidCommand());
      expect(event.eventType).toBe(EventType.COMMISSION_RECEIVED);
      expect(event.economicEffect).toBe(EconomicEffect.CASH_IN);
    });

    it("generates a hash on the created event", async () => {
      const event = await useCase.execute(makeValidCommand());
      expect(event.hash.value).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ============================
  // previousHash auto-chaining
  // ============================
  describe("previousHash auto-chaining", () => {
    it("always fetches the last event hash from the repository", async () => {
      await useCase.execute(makeValidCommand());
      expect(repo.getLastEventHash).toHaveBeenCalledOnce();
    });

    it("sets previousHash to null when the ledger is empty (big bang)", async () => {
      repo.getLastEventHash.mockResolvedValue(null);
      const event = await useCase.execute(makeValidCommand());
      expect(event.previousHash).toBeNull();
    });

    it("chains to the last registered event's hash", async () => {
      const { EventHash } = await import("../../../core/domain/value-objects/EventHash");
      const lastHash = EventHash.fromValue("a".repeat(64));
      repo.getLastEventHash.mockResolvedValue(lastHash);

      const event = await useCase.execute(makeValidCommand());
      expect(event.previousHash?.value).toBe("a".repeat(64));
    });

    it("never calls getByHash for chain resolution", async () => {
      await useCase.execute(makeValidCommand());
      expect(repo.getByHash).not.toHaveBeenCalled();
    });
  });

  // ============================
  // Domain invariant enforcement
  // ============================
  describe("domain invariants propagate to use case", () => {
    it("throws when amount is zero", async () => {
      await expect(
        useCase.execute(makeValidCommand({ amount: "0" })),
      ).rejects.toThrow();
    });

    it("throws when amount format is invalid (too many decimals)", async () => {
      await expect(
        useCase.execute(makeValidCommand({ amount: "100.999" })),
      ).rejects.toThrow();
    });

    it("does not save to repo when domain validation fails", async () => {
      await expect(
        useCase.execute(makeValidCommand({ amount: "0" })),
      ).rejects.toThrow();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ============================
  // Valid events always reach the ledger (Critical)
  // ============================
  describe("critical invariant — valid events reach the ledger", () => {
    it("every valid command results in exactly one saved event", async () => {
      await useCase.execute(makeValidCommand());
      await useCase.execute(makeValidCommand({ sourceReference: "ref-002" }));
      expect(repo.save).toHaveBeenCalledTimes(2);
    });
  });

  // ============================
  // Idempotency via commandId
  // ============================
  describe("idempotency — commandId", () => {
    it("returns the existing event when commandId already exists in the ledger", async () => {
      const existingEvent = LedgerEvent.create(makeValidProps());
      repo.getByCommandId.mockResolvedValue(existingEvent);

      const result = await useCase.execute(
        makeValidCommand({ commandId: "cmd-abc-123" }),
      );
      expect(result).toBe(existingEvent);
    });

    it("does not save to the repository when commandId already exists", async () => {
      const existingEvent = LedgerEvent.create(makeValidProps());
      repo.getByCommandId.mockResolvedValue(existingEvent);

      await useCase.execute(makeValidCommand({ commandId: "cmd-abc-123" }));
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("calls getByCommandId with the exact commandId from the command", async () => {
      const existingEvent = LedgerEvent.create(makeValidProps());
      repo.getByCommandId.mockResolvedValue(existingEvent);

      await useCase.execute(makeValidCommand({ commandId: "cmd-abc-123" }));
      expect(repo.getByCommandId).toHaveBeenCalledWith("cmd-abc-123");
    });

    it("creates a new event when commandId is not found in the ledger", async () => {
      repo.getByCommandId.mockResolvedValue(null);

      const event = await useCase.execute(
        makeValidCommand({ commandId: "cmd-new-456" }),
      );
      expect(event).toBeInstanceOf(LedgerEvent);
      expect(repo.save).toHaveBeenCalledOnce();
    });

    it("does not call getByCommandId when commandId is absent", async () => {
      await useCase.execute(makeValidCommand({ commandId: null }));
      expect(repo.getByCommandId).not.toHaveBeenCalled();
    });

    it("stores the commandId on the created event", async () => {
      const event = await useCase.execute(
        makeValidCommand({ commandId: "cmd-stored-789" }),
      );
      expect(event.commandId).toBe("cmd-stored-789");
    });

    it("event has null commandId when none is provided", async () => {
      const event = await useCase.execute(makeValidCommand({ commandId: null }));
      expect(event.commandId).toBeNull();
    });
  });
});
