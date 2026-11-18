import { describe, it, expect } from "vitest";
import {
  alertPosition,
  compensationProblem,
  matchingParties,
  openAfter,
  selectionOffer,
  type PickedLine,
  othersInEvent,
  pendingSummary,
  positionFromLifecycle,
  recordedOnAnotherDay,
  rowAction,
} from "@/features/parties/partiesEngine";
import type { PartyEventView, PartyName, PendingIdentity } from "@/features/parties/partiesApi";

const named = (...names: string[]): PendingIdentity[] =>
  names.map((displayName, i) => ({ partyId: `p${i}`, displayName, kind: "provisional" }));

describe("pendingSummary", () => {
  it("sem pendências, não há o que dizer", () => {
    expect(pendingSummary([])).toBeNull();
  });

  it("nomeia até três", () => {
    expect(pendingSummary(named("A", "B", "C"))).toEqual({ count: 3, names: "A, B, C" });
  });

  it("conta o que passa de três, para caber em uma linha", () => {
    expect(pendingSummary(named("A", "B", "C", "D", "E"))).toEqual({ count: 5, names: "A, B, C +2" });
  });
});

describe("matchingParties", () => {
  const parties: PartyName[] = ["João Silva", "Argo Ltda", "Joana Lima"].map((displayName, i) => ({
    partyId: `p${i}`,
    displayName,
    state: "identified",
  }));
  const names = (query: string) => matchingParties(parties, query).map((p) => p.displayName);

  it("sem busca, lista em ordem alfabética", () => {
    expect(names("")).toEqual(["Argo Ltda", "Joana Lima", "João Silva"]);
  });

  it("ignora maiúsculas e acentos", () => {
    expect(names("JOAO")).toEqual(["João Silva"]);
  });

  it("acha por qualquer parte do nome", () => {
    expect(names("lima")).toEqual(["Joana Lima"]);
  });

  it("respeita o limite, para a lista não tomar a tela com 250 partes", () => {
    expect(matchingParties(parties, "", 2)).toHaveLength(2);
  });
});

describe("othersInEvent", () => {
  const event = {
    parties: [
      { partyId: "joao", role: "payee", direction: "in", amount: null },
      { partyId: "argo", role: "payer", direction: "out", amount: null },
      { partyId: "party-x", role: "beneficiary", direction: "neutral", amount: null },
    ],
    roles: [{ role: "payee", direction: "in", recordedAs: "joao" }],
  } as PartyEventView;

  it("mostra os outros pelo nome, e o id de quem o cadastro não conhece", () => {
    expect(othersInEvent(event, { argo: "Argo Ltda" })).toEqual(["Argo Ltda", "party-x"]);
  });
});

describe("recordedOnAnotherDay (CA-636)", () => {
  it("as duas datas só quando diferem", () => {
    expect(recordedOnAnotherDay("2026-11-09T12:00:00.000Z", "2026-11-10T15:00:00.000Z")).toBe(true);
    expect(recordedOnAnotherDay("2026-11-09T12:00:00.000Z", "2026-11-09T18:00:00.000Z")).toBe(false);
  });
});

describe("REQ-691 — from a line or an alert of Operação to the position's detail", () => {
  it("names the line's button after the side it is on, and only for whoever can write", () => {
    expect(rowAction("usinaOwes", true)).toBe("pay");
    expect(rowAction("partyOwes", true)).toBe("receive");
    expect(rowAction("unclassified", true)).toBe("view");
    expect(rowAction("usinaOwes", false)).toBe("view");
    expect(rowAction("partyOwes", false)).toBe("view");
  });

  it("leads from an alert to the position it speaks about, and from no other", () => {
    expect(alertPosition({ code: "obligation_overdue", objectId: "cp-1", dueAt: "2026-11-01" })).toBe("cp-1");
    expect(alertPosition({ code: "paid_without_obligation", objectId: "cp-2" })).toBe("cp-2");
    expect(alertPosition({ code: "provisional_identity" })).toBeNull();
  });

  it("reads the position from its lifecycle, inventing no date it does not state", () => {
    const event = (occurredAt: string, recordedAt: string) => ({
      eventId: occurredAt,
      eventType: "advance_payment",
      economicEffect: "cash_out",
      relation: "originates",
      amount: "500.00",
      currency: "BRL",
      occurredAt,
      recordedAt,
      description: null,
      relatedEventId: null,
      retracted: false,
      requiresFollowup: false,
      objects: [],
    });
    const lifecycle = {
      objectId: "adv-1",
      objectType: "advance",
      status: "partially_settled",
      outcome: "pending",
      currency: "BRL",
      totalOriginated: "500.00",
      totalSettled: "300.00",
      openBalance: "200.00",
      eventCount: 2,
      events: [event("2026-10-01", "2026-10-01T12:00:00Z"), event("2026-11-18", "2026-11-18T12:00:00Z")],
      origin: null,
      partyNames: {},
    };

    const position = positionFromLifecycle(lifecycle as unknown as Parameters<typeof positionFromLifecycle>[0]);

    expect(position).toMatchObject({ objectId: "adv-1", objectType: "advance", openBalance: "200.00", currency: "BRL" });
    expect(position.lastEventAt).toBe("2026-11-18");
    expect(position.createdAt).toBe("2026-10-01T12:00:00Z");
    expect(position.dueAt).toBeNull();
    expect(positionFromLifecycle({ ...lifecycle, openBalance: null, events: [] } as never)).toMatchObject({
      openBalance: null,
      lastEventAt: null,
      createdAt: null,
    });
  });
});

describe("REQ-692 — a seleção diz o que é possível", () => {
  const line = (objectId: string, objectType: string, side: PickedLine["side"], openBalance: string | null = "100.00"): PickedLine => ({
    objectId,
    objectType,
    side,
    openBalance,
  });
  const adv = line("adv", "advance", "partyOwes", "500.00");
  const cpA = line("cpA", "commission_payable", "usinaOwes", "300.00");
  const cpB = line("cpB", "commission_payable", "usinaOwes", "400.00");

  it("nada marcado, nada oferecido", () => {
    expect(selectionOffer([])).toBeNull();
  });

  it("só o que a Usina deve → o lote da parte", () => {
    expect(selectionOffer([cpA, cpB])).toEqual({ kind: "batch" });
  });

  it("CA-692: um adiantamento e uma obrigação de comissão → compensar até o menor saldo", () => {
    expect(selectionOffer([adv, cpA])).toMatchObject({ kind: "compensate", receivable: adv, payable: cpA, max: "300.00" });
    expect(selectionOffer([line("loan", "loan", "partyOwes", "50.00"), cpA])).toMatchObject({ kind: "compensate", max: "50.00" });
  });

  it("CA-692 / REJ-693: dois de um lado → nada, um par por compensação", () => {
    expect(selectionOffer([adv, cpA, cpB])).toEqual({ kind: "none", reason: "onePair" });
    expect(selectionOffer([adv, line("adv2", "advance", "partyOwes"), cpA])).toEqual({ kind: "none", reason: "onePair" });
  });

  it("tipos fora da compensação → nada, com o motivo", () => {
    expect(selectionOffer([adv, line("bill", "payable", "usinaOwes")])).toEqual({ kind: "none", reason: "compensableKinds" });
    expect(selectionOffer([line("cr", "commission_receivable", "partyOwes"), cpA])).toEqual({ kind: "none", reason: "compensableKinds" });
  });

  it("só o que a parte deve, algo sem lado, ou sem saldo conhecido → nada, com o motivo", () => {
    expect(selectionOffer([adv])).toEqual({ kind: "none", reason: "receivablesOnly" });
    expect(selectionOffer([line("x", "policy", "unclassified"), cpA])).toEqual({ kind: "none", reason: "unclassified" });
    expect(selectionOffer([adv, line("cpU", "commission_payable", "usinaOwes", null)])).toEqual({ kind: "none", reason: "balance" });
  });

  it("REQ-693: a prévia mostra o que fica aberto, e recusa zero e o que passa do máximo", () => {
    expect(openAfter("500.00", "30000")).toBe("200.00");
    expect(openAfter("300.00", "30000")).toBe("0.00");
    expect(compensationProblem("", "300.00")).toBe("zero");
    expect(compensationProblem("30001", "300.00")).toBe("over");
    expect(compensationProblem("30000", "300.00")).toBeNull();
  });
});
