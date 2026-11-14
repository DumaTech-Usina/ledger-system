import { describe, it, expect } from "vitest";
import { declaredOf, firstReceivableWindow, payerLabel } from "@/features/receivables/receivablesEngine";
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
