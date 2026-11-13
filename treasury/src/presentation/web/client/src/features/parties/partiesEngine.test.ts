import { describe, it, expect } from "vitest";
import { matchingParties, othersInEvent, pendingSummary, recordedOnAnotherDay } from "@/features/parties/partiesEngine";
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
