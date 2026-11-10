import { describe, it, expect } from "vitest";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { StagingRecordValidator } from "../../../core/application/services/StagingRecordValidator";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { SubmitCandidateUseCase } from "../../../core/application/use-cases/SubmitCandidateUseCase";
import { SubmitCandidateInput } from "../../../core/application/dtos/SubmitCandidateInput";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";

/**
 * Treasury §4.6 (REQ-261, REQ-265, REQ-267): the two facts the insurance system's signals propose,
 * in the exact shape Treasury's CandidateMapper sends — medium confidence, a source reference derived
 * from the policy, and the policy cited as a `contract` context. Nothing in the Ledger changed for
 * this; the test pins that the existing contracts accept it.
 */
const POLICY = "seguro:apolice:5177202641312121285";

const expected: SubmitCandidateInput = {
  sourceReference: `${POLICY}:prevista`,
  eventType: "commission_expected",
  economicEffect: "non_cash",
  occurredAt: "2026-10-01T03:00:00.000Z",
  amount: "128.77",
  currency: "BRL",
  description: "Comissão da apólice 5177202641312121285",
  // REQ-273: the insurer named as who is expected to pay.
  parties: [
    { partyId: "party-usina", role: "beneficiary", direction: "neutral" },
    { partyId: "party-allianz", role: "payer", direction: "neutral" },
  ],
  objects: [
    { objectId: `${POLICY}:prevista`, objectType: "commission_receivable", relation: "originates" },
    { objectId: POLICY, objectType: "contract", relation: "references" },
  ],
  reason: { type: "commission_accrual", description: "Expected commission", confidence: "medium", requiresFollowup: false },
  reporter: { reporterType: "user", reporterId: "user-cfo", channel: "web" },
} as SubmitCandidateInput;

const obligation: SubmitCandidateInput = {
  sourceReference: `${POLICY}:elegibilidade`,
  eventType: "obligation_recognized",
  economicEffect: "non_cash",
  occurredAt: "2026-10-21T03:00:00.000Z",
  amount: "77.26",
  currency: "BRL",
  description: "Repasse da apólice 5177202641312121285 (elegível em 21/10/2026)",
  parties: [
    { partyId: "party-usina", role: "payer", direction: "neutral" },
    { partyId: "party-halisson", role: "payee", direction: "neutral" },
  ],
  objects: [
    { objectId: `${POLICY}:elegibilidade`, objectType: "commission_payable", relation: "originates" },
    { objectId: POLICY, objectType: "contract", relation: "references" },
  ],
  reason: { type: "obligation_recognition", description: "Obligation established by an external fact", confidence: "medium", requiresFollowup: false },
  reporter: { reporterType: "user", reporterId: "user-cfo", channel: "web" },
} as SubmitCandidateInput;

function build() {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const validator = new StagingRecordValidator(ledgerRepo);
  const create = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
  return { ledgerRepo, submit: new SubmitCandidateUseCase(validator, create, ledgerRepo) };
}

describe("Treasury §4.6 — fatos propostos por sinal do sistema de seguro", () => {
  it("aceita a comissão prevista e a obrigação com confiança média, citando a apólice", async () => {
    const { submit } = build();

    expect((await submit.execute(expected, expected.sourceReference)).status).toBe("accepted");
    expect((await submit.execute(obligation, obligation.sourceReference)).status).toBe("accepted");
  });

  it("consultar a apólice devolve os dois fatos que a citam", async () => {
    const { ledgerRepo, submit } = build();
    await submit.execute(expected, expected.sourceReference);
    await submit.execute(obligation, obligation.sourceReference);

    const cited = await ledgerRepo.findByObjectId(POLICY);
    expect(cited.map((e) => e.eventType).sort()).toEqual(["commission_expected", "obligation_recognized"]);
  });

  it("a comissão prevista sem quem paga continua aceita", async () => {
    const { submit } = build();
    const withoutPayer = { ...expected, sourceReference: `${POLICY}:sem-pagador`, parties: [expected.parties[0]] };

    expect((await submit.execute(withoutPayer, withoutPayer.sourceReference)).status).toBe("accepted");
  });

  it("o recebimento da seguradora quita a comissão prevista", async () => {
    const { ledgerRepo, submit } = build();
    const first = await submit.execute(expected, expected.sourceReference);
    const expectedId = first.status === "accepted" ? first.ledgerReference : "";
    const received = {
      ...expected,
      sourceReference: "intent:receipt",
      eventType: "commission_received",
      economicEffect: "cash_in",
      relatedEventId: expectedId,
      parties: [
        { partyId: "party-usina", role: "payee", direction: "in", amount: "128.77" },
        { partyId: "party-allianz", role: "payer", direction: "neutral" },
      ],
      objects: [{ objectId: `${POLICY}:prevista`, objectType: "commission_receivable", relation: "settles" }],
      reason: { type: "commission_payment", description: "Commission received", confidence: "high", requiresFollowup: false },
    } as SubmitCandidateInput;

    expect((await submit.execute(received, "intent:receipt")).status).toBe("accepted");
    const onPosition = await ledgerRepo.findByObjectId(`${POLICY}:prevista`);
    expect(onPosition.map((e) => e.eventType)).toEqual(["commission_expected", "commission_received"]);
  });

  it("REQ-275: recebimento e repasse citam a apólice; ela devolve os quatro fatos e o que ficou com a Usina", async () => {
    const { ledgerRepo, submit } = build();
    const first = await submit.execute(expected, expected.sourceReference);
    const expectedId = first.status === "accepted" ? first.ledgerReference : "";
    await submit.execute(obligation, obligation.sourceReference);
    const policyContext = { objectId: POLICY, objectType: "contract", relation: "references" };

    const received = {
      ...expected,
      sourceReference: "intent:receipt",
      eventType: "commission_received",
      economicEffect: "cash_in",
      occurredAt: "2026-11-10T03:00:00.000Z",
      relatedEventId: expectedId,
      parties: [
        { partyId: "party-usina", role: "payee", direction: "in", amount: "128.77" },
        { partyId: "party-allianz", role: "payer", direction: "neutral" },
      ],
      objects: [{ objectId: `${POLICY}:prevista`, objectType: "commission_receivable", relation: "settles" }, policyContext],
      reason: { type: "commission_payment", description: "Commission received", confidence: "high", requiresFollowup: false },
    } as SubmitCandidateInput;
    const paid = {
      ...obligation,
      sourceReference: "intent:payout",
      eventType: "commission_split",
      economicEffect: "cash_out",
      occurredAt: "2026-11-11T03:00:00.000Z",
      parties: [
        { partyId: "party-usina", role: "payer", direction: "out", amount: "77.26" },
        { partyId: "party-halisson", role: "payee", direction: "neutral" },
      ],
      objects: [{ objectId: `${POLICY}:elegibilidade`, objectType: "commission_payable", relation: "settles" }, policyContext],
      reason: { type: "commission_split", description: "Commission pass-through paid", confidence: "high", requiresFollowup: false },
    } as SubmitCandidateInput;

    expect((await submit.execute(received, "intent:receipt")).status).toBe("accepted");
    expect((await submit.execute(paid, "intent:payout")).status).toBe("accepted");

    const cited = await ledgerRepo.findByObjectId(POLICY);
    expect(cited.map((e) => e.eventType)).toEqual([
      "commission_expected",
      "obligation_recognized",
      "commission_received",
      "commission_split",
    ]);
    const policy = await new PositionProjectionService(ledgerRepo).summarize(POLICY);
    expect(policy?.allocationGap.toString()).toBe("51.51");
  });

  it("um evento pode citar vários contextos", async () => {
    const { ledgerRepo, submit } = build();
    const withBatch = {
      ...expected,
      objects: [...expected.objects, { objectId: "lote-allianz-1", objectType: "settlement_batch", relation: "references" }],
    } as SubmitCandidateInput;

    expect((await submit.execute(withBatch, withBatch.sourceReference)).status).toBe("accepted");
    expect(await ledgerRepo.findByObjectId("lote-allianz-1")).toHaveLength(1);
    expect(await ledgerRepo.findByObjectId(POLICY)).toHaveLength(1);
  });

  it("REQ-277: crédito em lote — um recebimento por apólice citando o lote, e o resto sem origem", async () => {
    const { ledgerRepo, submit } = build();
    const first = await submit.execute(expected, expected.sourceReference);
    const expectedId = first.status === "accepted" ? first.ledgerReference : "";
    const LOTE = "lote:allianz-2026-11-10";
    const receipt = (ref: string, amount: string, objects: SubmitCandidateInput["objects"], relatedEventId?: string, orphan = false) =>
      ({
        ...expected,
        sourceReference: ref,
        eventType: "commission_received",
        economicEffect: "cash_in",
        occurredAt: "2026-11-10T03:00:00.000Z",
        amount,
        ...(relatedEventId ? { relatedEventId } : {}),
        parties: [
          { partyId: "party-usina", role: "payee", direction: "in", amount },
          { partyId: "party-allianz", role: "payer", direction: "neutral" },
        ],
        objects,
        reason: orphan
          ? { type: "unknown_origin", description: "Commission received; originating expected unknown", confidence: "high", requiresFollowup: true }
          : { type: "commission_payment", description: "Commission received", confidence: "high", requiresFollowup: false },
      }) as SubmitCandidateInput;
    const batch = { objectId: LOTE, objectType: "settlement_batch", relation: "references" };

    const allocated = receipt("intent:lote-1", "128.77", [
      { objectId: `${POLICY}:prevista`, objectType: "commission_receivable", relation: "settles" },
      { objectId: POLICY, objectType: "contract", relation: "references" },
      batch,
    ], expectedId);
    const unattributed = receipt("intent:lote-2", "100.00", [
      { objectId: "intent:lote-2", objectType: "commission_receivable", relation: "settles" },
      batch,
    ], undefined, true);

    expect((await submit.execute(allocated, "intent:lote-1")).status).toBe("accepted");
    expect((await submit.execute(unattributed, "intent:lote-2")).status).toBe("accepted");

    expect((await ledgerRepo.findByObjectId(LOTE)).map((e) => e.amount.toString())).toEqual(["128.77", "100.00"]);
    const summary = await new PositionProjectionService(ledgerRepo).summarize(`${POLICY}:prevista`);
    expect(summary?.openBalance?.toString()).toBe("0.00");
  });

  it("o mesmo sinal confirmado de novo é recusado como duplicado", async () => {
    const { submit } = build();
    await submit.execute(obligation, "key-1");

    const again = await submit.execute(obligation, "key-2");
    expect(again.status).toBe("rejected");
    if (again.status === "rejected") expect(again.rejections[0]).toMatchObject({ category: "duplicate" });
  });
});
