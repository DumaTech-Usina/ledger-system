import { describe, it, expect } from "vitest";
import { creditPayer, declaredOf, firstReceivableWindow, lineActions, payerLabel } from "@/features/receivables/receivablesEngine";
import type { DeclaredLine } from "@/features/receivables/receivablesApi";

const empty = { count: 0 };

describe("receivables agenda (§8.7)", () => {
  it("opens on the most urgent window with something in it", () => {
    expect(firstReceivableWindow({ overdue: empty, today: empty, next: { count: 2 }, later: { count: 1 }, undated: empty })).toBe("next");
    expect(firstReceivableWindow({ overdue: empty, today: empty, next: empty, later: empty, undated: empty })).toBe("today");
  });

  it("REJ-662: a line naming no payer says so, never guesses one", () => {
    expect(payerLabel([], "Pagador não informado")).toBe("Pagador não informado");
    expect(payerLabel([{ partyId: "a", displayName: "Allianz" }, { partyId: "b", displayName: "Porto" }], "-")).toBe("Allianz, Porto");
  });

  it("REQ-663: the declared list follows the chosen payer, including 'no payer named'", () => {
    const line = (objectId: string, payerKey: string) => ({ objectId, payerKey }) as DeclaredLine;
    const lines = [line("a", "allianz"), line("b", ""), line("c", "porto")];
    expect(declaredOf(lines, null).map((l) => l.objectId)).toEqual(["a", "b", "c"]);
    expect(declaredOf(lines, "allianz").map((l) => l.objectId)).toEqual(["a"]);
    expect(declaredOf(lines, "").map((l) => l.objectId)).toEqual(["b"]);
  });
});

describe("REQ-696 — o adiantamento leva à compensação", () => {
  const joao = { partyId: "joao", displayName: "João" };
  const can = { canReceive: true, unlinked: false };

  it("CA-696: adiantamento ou empréstimo de uma parte → compensar, e receber continua oferecido", () => {
    expect(lineActions({ objectType: "advance", payers: [joao] }, can)).toEqual({ primary: "compensate", alsoReceive: true });
    expect(lineActions({ objectType: "loan", payers: [joao] }, can)).toEqual({ primary: "compensate", alsoReceive: true });
  });

  it("sem uma parte conhecida, ou outro tipo, a linha oferece receber, como antes", () => {
    expect(lineActions({ objectType: "advance", payers: [] }, can)).toEqual({ primary: "receive", alsoReceive: false });
    expect(lineActions({ objectType: "advance", payers: [joao, { partyId: "argo", displayName: "Argo" }] }, can).primary).toBe("receive");
    expect(lineActions({ objectType: "commission_receivable", payers: [joao] }, can)).toEqual({ primary: "receive", alsoReceive: false });
  });

  it("quem só consulta vê, e o recebido sem origem não se recebe de novo", () => {
    expect(lineActions({ objectType: "advance", payers: [joao] }, { canReceive: false, unlinked: false }).primary).toBe("view");
    expect(lineActions({ objectType: "advance", payers: [joao] }, { canReceive: true, unlinked: true }).primary).toBe("view");
  });
});

describe("REQ-695 — o crédito pelo pagador escolhido", () => {
  const allianz = { partyId: "allianz", displayName: "Allianz" };
  const groups = [
    { key: "allianz", payers: [allianz] },
    { key: "", payers: [] },
    { key: "a+b", payers: [allianz, { partyId: "porto", displayName: "Porto" }] },
  ];

  it("CA-695: um pagador escolhido, de uma parte só → o crédito é dele", () => {
    expect(creditPayer(groups, "allianz")).toEqual(allianz);
  });

  it("sem pagador escolhido, pagador não informado ou grupo de várias partes → sem crédito", () => {
    expect(creditPayer(groups, null)).toBeNull();
    expect(creditPayer(groups, "")).toBeNull();
    expect(creditPayer(groups, "a+b")).toBeNull();
    expect(creditPayer(groups, "nobody")).toBeNull();
  });
});
