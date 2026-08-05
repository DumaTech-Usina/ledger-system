import { describe, it, expect } from "vitest";
import { ListSettlementCandidatesUseCase } from "../../../core/application/use-cases/ListSettlementCandidates";
import { continuityObjectType } from "../../../core/application/services/CandidateMapper";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";
import type { IntentRepository } from "../../../core/application/repositories/IntentRepository";
import type { PositionCandidate, PositionLookupPort } from "../../../core/application/ports/PositionLookupPort";
import { PARTY, PARTY_DISPLAY_NAMES, emptyPartyDirectory, partyDirectory } from "../../fixtures/parties";

const intentFor = (scenarioId: string) =>
  Intent.rehydrate({
    id: "intent-1",
    scenarioId,
    userId: "cfo",
    status: IntentStatus.GATHERING,
    answers: {},
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });

const intents = (scenarioId: string): IntentRepository =>
  ({
    findById: async () => intentFor(scenarioId),
  }) as unknown as IntentRepository;

const advance: PositionCandidate = {
  objectId: "intent:adv-1",
  objectType: "advance",
  originEventId: "evt-origin-1",
  counterpartyId: PARTY.BROKER,
  totalOriginated: "500.00",
  openBalance: "500.00",
  currency: "BRL",
  originatedAt: "2026-07-02T00:00:00.000Z",
};

const lookup = (candidates: PositionCandidate[]): PositionLookupPort => ({
  openPositions: async () => candidates,
});

describe("continuityObjectType", () => {
  it("names the position kind for the scenarios that declare one", () => {
    expect(continuityObjectType("register_advance_settlement")).toBe("advance");
    expect(continuityObjectType("register_rectification")).toBe("advance");
  });

  it("is undefined for cash expenses — they settle positions nobody originated", () => {
    for (const scenario of ["register_payment", "register_payroll", "register_penalty", "register_infrastructure"]) {
      expect(continuityObjectType(scenario)).toBeUndefined();
    }
  });

  it("is undefined for a scenario with no mapping at all", () => {
    expect(continuityObjectType("not_a_scenario")).toBeUndefined();
  });
});

describe("ListSettlementCandidatesUseCase", () => {
  it("offers each open position with the name, amount and origination date behind it", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([advance]),
      partyDirectory(),
    );
    const result = await uc.execute("intent-1");

    expect(result.slots).toEqual({ continuity: "objectRef", lineage: "origin" });
    expect(result.candidates).toEqual([
      {
        objectId: "intent:adv-1",
        originEventId: "evt-origin-1",
        counterparty: PARTY_DISPLAY_NAMES[PARTY.BROKER],
        totalOriginated: "500.00",
        // Equal to what was originated ⇒ nothing settled yet, so no second figure is shown.
        openBalance: null,
        currency: "BRL",
        originatedAt: "2026-07-02T00:00:00.000Z",
      },
    ]);
  });

  it("shows what is still open once a position was partly settled", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([{ ...advance, openBalance: "250.00" }]),
      partyDirectory(),
    );
    const [candidate] = (await uc.execute("intent-1")).candidates;
    expect(candidate.totalOriginated).toBe("500.00");
    expect(candidate.openBalance).toBe("250.00");
  });

  it("keeps the id on screen when the Directory cannot name the counterparty", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([advance]),
      emptyPartyDirectory(),
    );
    const [candidate] = (await uc.execute("intent-1")).candidates;
    expect(candidate.counterparty).toBe(PARTY.BROKER);
  });

  it("shows no counterparty at all when the Ledger recorded no origination", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([{ ...advance, counterpartyId: null, originEventId: null }]),
      partyDirectory(),
    );
    const [candidate] = (await uc.execute("intent-1")).candidates;
    expect(candidate.counterparty).toBeNull();
    expect(candidate.originEventId).toBeNull();
  });

  it("does not offer a position whose origination was rectified", async () => {
    // The Ledger still reports it as `open` — status falls out of a zero origination, not out of
    // the retraction — so the standing origination is the only thing that tells them apart.
    const rectified: PositionCandidate = {
      ...advance,
      originEventId: null,
      counterpartyId: null,
      totalOriginated: "0.00",
      openBalance: "0.00",
      originatedAt: null,
    };
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([rectified, advance]),
      partyDirectory(),
    );
    const { candidates } = await uc.execute("intent-1");
    expect(candidates.map((c) => c.objectId)).toEqual(["intent:adv-1"]);
  });

  it("offers nothing for a scenario that admits no continuity — the question never appears", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_payroll"),
      lookup([advance]),
      partyDirectory(),
    );
    expect(await uc.execute("intent-1")).toEqual({ slots: {}, candidates: [] });
  });

  it("offers nothing when the Ledger holds no open position of that kind", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([]),
      partyDirectory(),
    );
    expect((await uc.execute("intent-1")).candidates).toEqual([]);
  });

  it("keeps the candidates when the Directory is down — names are legibility, not truth", async () => {
    const brokenDirectory = {
      get: () => Promise.reject(new Error("down")),
      list: () => Promise.reject(new Error("down")),
      resolve: () => Promise.reject(new Error("down")),
    };
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([advance]),
      brokenDirectory,
    );
    const [candidate] = (await uc.execute("intent-1")).candidates;
    expect(candidate.counterparty).toBe(PARTY.BROKER);
    expect(candidate.objectId).toBe("intent:adv-1");
  });
});
