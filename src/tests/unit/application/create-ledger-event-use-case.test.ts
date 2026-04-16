import { beforeEach, describe, expect, it, vi, Mocked } from "vitest";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { makeValidCommand } from "../../fixtures";

function makeMockRepo(): Mocked<LedgerEventRepository> {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    getLastEventHash: vi.fn().mockResolvedValue(null),
    existsBySourceReference: vi.fn().mockResolvedValue(false),
    findAll: vi.fn().mockResolvedValue([]),
  } as unknown as Mocked<LedgerEventRepository>;
}

describe("CreateLedgerEventUseCase", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let useCase: CreateLedgerEventUseCase;

  beforeEach(() => {
    repo = makeMockRepo();
    useCase = new CreateLedgerEventUseCase(repo);
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
  // previousHash chaining
  // ============================
  describe("previousHash chaining", () => {
    it("fetches last hash from repo when no previousHash is given", async () => {
      await useCase.execute(makeValidCommand({ previousHash: null }));
      expect(repo.getLastEventHash).toHaveBeenCalledOnce();
    });

    it("does not fetch last hash from repo when previousHash is provided", async () => {
      await useCase.execute(
        makeValidCommand({ previousHash: "some-prev-hash" }),
      );
      expect(repo.getLastEventHash).not.toHaveBeenCalled();
    });

    it("sets previousHash to null when repo has no previous event", async () => {
      repo.getLastEventHash.mockResolvedValue(null);
      const event = await useCase.execute(
        makeValidCommand({ previousHash: null }),
      );
      expect(event.previousHash).toBeNull();
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
});
