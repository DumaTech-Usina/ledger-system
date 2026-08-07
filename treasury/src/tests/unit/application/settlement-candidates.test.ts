import { describe, it, expect } from "vitest";
import { ListSettlementCandidatesUseCase } from "../../../core/application/use-cases/ListSettlementCandidates";
import { CandidateMapper, continuityObjectType } from "../../../core/application/services/CandidateMapper";
import { getScenario } from "../../../core/domain/scenarios/Scenario";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";
import type { IntentRepository } from "../../../core/application/repositories/IntentRepository";
import type { PositionCandidate, PositionLookupPort } from "../../../core/application/ports/PositionLookupPort";
import { PARTY, PARTY_DISPLAY_NAMES, emptyPartyDirectory, partyDirectory } from "../../fixtures/parties";

const intentFor = (scenarioId: string, answers: Record<string, string> = {}) =>
  Intent.rehydrate({
    id: "intent-1",
    scenarioId,
    userId: "cfo",
    status: IntentStatus.GATHERING,
    answers,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });

const intents = (scenarioId: string, answers: Record<string, string> = {}): IntentRepository =>
  ({
    findById: async () => intentFor(scenarioId, answers),
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

const lookup = (
  candidates: PositionCandidate[],
  unoriginated: PositionCandidate[] = [],
): PositionLookupPort => ({
  openPositions: async () => candidates,
  unoriginatedPositions: async () => unoriginated,
});

/** A payroll paid on its own: settled, and nothing ever originated it. */
const paidPayroll: PositionCandidate = {
  objectId: "intent:payroll-1",
  objectType: "payroll",
  originEventId: null,
  counterpartyId: null,
  totalOriginated: "0.00",
  openBalance: "0.00",
  currency: "BRL",
  originatedAt: null,
};

describe("continuityObjectType", () => {
  it("names the position kind for the scenarios that declare one", () => {
    expect(continuityObjectType("register_advance_settlement")).toBe("advance");
    // Rectification branches too: which kind it is about comes from the corrected entry, which
    // `SubmitRectification` reads from the Ledger and answers before anything is offered.
    expect(continuityObjectType("register_rectification", { objectType: "loan" })).toBe("loan");
  });

  it("offers nothing while the branch that decides the kind is unanswered", () => {
    // There is no single kind to ask about yet, and picking the base template would list the wrong
    // positions. Absence is the honest answer until the answer that settles it exists.
    expect(continuityObjectType("register_obligation_recognition")).toBeUndefined();
    expect(continuityObjectType("register_rectification")).toBeUndefined();
  });

  /**
   * These three used to admit no continuity, on the premise that nothing could originate the
   * positions they settle. OBLIGATION_RECOGNIZED changed that premise: a payroll, an infrastructure
   * cost or a generic payable can now be recognized before it is paid, so pointing the payment at
   * the obligation it closes is a question with a real answer. The offer stays optional — a payment
   * with no prior recognition is still the ordinary cash-basis fact.
   */
  it("names the position kind for the expenses an obligation can now be recognized for", () => {
    expect(continuityObjectType("register_payroll")).toBe("payroll");
    expect(continuityObjectType("register_infrastructure")).toBe("infrastructure_cost");
    expect(continuityObjectType("register_payment")).toBe("payable");
  });

  /**
   * The continuity question has to be about the kind of position the scenario will ACTUALLY
   * originate — that is the whole meaning of the offer. Asking "which payment does this obligation
   * explain?" while looking up a different kind of position lists the wrong things, and the paid
   * payroll the operator is trying to point at never appears.
   *
   * So the invariant is stated against what `build` emits rather than against a literal: whatever
   * the scenario ends up recording for a given branch is what its continuity question must ask
   * about. A scenario without variants satisfies this trivially; one with variants only satisfies
   * it if the lookup is variant-aware.
   */
  it("asks about the kind of position the recognition will actually originate", () => {
    const scenarioId = "register_obligation_recognition";
    const scenario = getScenario(scenarioId)!;
    const intent = Intent.rehydrate({
      id: "intent-recognition",
      scenarioId,
      userId: "cfo",
      status: IntentStatus.AWAITING_CONFIRMATION,
      answers: {
        kind: "payroll",
        payee: PARTY.BROKER,
        amount: "45000.00",
        currency: "BRL",
        occurredAt: "2026-08-06",
      },
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    });

    const emitted = new CandidateMapper(PARTY.USINA).build(intent, scenario).objects[0].objectType;

    expect(emitted).toBe("payroll");
    expect(continuityObjectType(scenarioId, intent.answers)).toBe(emitted);
  });

  it("is still undefined for a penalty — no event type originates a PENALTY, so there is nothing to point at", () => {
    expect(continuityObjectType("register_penalty")).toBeUndefined();
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
      // A penalty settles a position no event type originates, so there is still nothing to offer.
      intents("register_penalty"),
      lookup([advance]),
      partyDirectory(),
    );
    expect(await uc.execute("intent-1")).toEqual({ slots: {}, candidates: [] });
  });

  it("a recognition is offered the mirror shape: positions already settled that nothing originated", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_obligation_recognition", { kind: "payroll" }),
      // The open list holds an advance; the unoriginated list holds the paid payroll. Only the
      // second may be offered — a recognition supplies an origination, it does not settle anything.
      lookup([advance], [paidPayroll]),
      partyDirectory(),
    );

    const { slots, candidates } = await uc.execute("intent-1");

    expect(slots.continuity).toBe("objectRef");
    expect(candidates.map((c) => c.objectId)).toEqual(["intent:payroll-1"]);
    // Nothing originated it, so there is no origin and no counterparty to name — and none is made up.
    expect(candidates[0].originEventId).toBeNull();
    expect(candidates[0].counterparty).toBeNull();
    expect(candidates[0].originatedAt).toBeNull();
  });

  it("a settlement is never offered an unoriginated position — the two questions do not cross", async () => {
    const uc = new ListSettlementCandidatesUseCase(
      intents("register_advance_settlement"),
      lookup([advance], [paidPayroll]),
      partyDirectory(),
    );
    const { candidates } = await uc.execute("intent-1");
    expect(candidates.map((c) => c.objectId)).toEqual(["intent:adv-1"]);
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
