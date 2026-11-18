import { describe, it, expect } from "vitest";
import { allOf, creditAllocations, creditTotals } from "./creditForm";

describe("crédito da seguradora — contas do formulário", () => {
  it("distribuído e o que sobra sem origem, em centavos", () => {
    expect(creditTotals({ creditDigits: "340000", allocations: { a: "12877", b: "100000", c: "217123" } })).toEqual({
      distributed: "3300.00",
      unattributed: "100.00",
      over: false,
    });
  });

  it("distribuir mais do que o crédito é sinalizado, sem sobra negativa", () => {
    expect(creditTotals({ creditDigits: "100000", allocations: { a: "150000" } })).toEqual({
      distributed: "1500.00",
      unattributed: "0.00",
      over: true,
    });
  });

  it("só envia o que foi preenchido, no formato do Ledger", () => {
    expect(creditAllocations({ creditDigits: "1", allocations: { a: "12877", b: "", c: "0" } })).toEqual([
      { objectId: "a", amount: "128.77" },
    ]);
  });

  it("'Tudo' preenche o aberto; aberto desconhecido não preenche", () => {
    expect(allOf("1000.00")).toBe("100000");
    expect(allOf(null)).toBe("");
  });
});

import { byProposal, labelFromPositionId, receivableLabel } from "./creditCopy";
import { visibleLines } from "./creditForm";

describe("REQ-292 — crédito da operadora de saúde", () => {
  const parcela = (proposalNumber: string, number: number) => ({
    objectId: `saude:proposta:${proposalNumber}:parcela:${number}:prevista`,
    policyId: null,
    installment: { proposalNumber, number },
  });

  it("a etiqueta é a parcela da proposta; no seguro, a apólice", () => {
    expect(receivableLabel(parcela("48213", 3), "pt-BR")).toBe("Proposta 48213 · parcela 3");
    expect(receivableLabel({ objectId: "seguro:apolice:5177:prevista", policyId: "5177" }, "pt-BR")).toBe("Apólice 5177");
    expect(receivableLabel({ objectId: "intent:x", policyId: null, installment: null }, "pt-BR")).toBe("intent:x");
    // A step already settled is no longer in the open list: its label comes from its id.
    expect(labelFromPositionId("saude:proposta:48213:parcela:3:prevista", "pt-BR")).toBe("Proposta 48213 · parcela 3");
    expect(labelFromPositionId("seguro:apolice:5177:prevista", "pt-BR")).toBe("Apólice 5177");
  });

  it("as parcelas vêm agrupadas por proposta e em ordem, e o resto depois", () => {
    const other = { objectId: "intent:x", policyId: null, installment: null };
    const sorted = byProposal([parcela("90001", 1), other, parcela("48213", 10), parcela("48213", 3)]);
    expect(sorted.map((r) => r.objectId)).toEqual([
      parcela("48213", 3).objectId,
      parcela("48213", 10).objectId,
      parcela("90001", 1).objectId,
      "intent:x",
    ]);
  });
});

describe("visibleLines — centenas de parcelas abertas", () => {
  const lines = Array.from({ length: 450 }, (_, n) => ({ objectId: `p${n}`, label: `Proposta ${1000 + Math.floor(n / 12)} · parcela ${(n % 12) + 1}` }));
  const label = (l: { label: string }) => l.label;

  it("desenha no máximo o limite e diz quantas existem", () => {
    const { shown, matching } = visibleLines(lines, {}, "", label, 100);
    expect(shown).toHaveLength(100);
    expect(matching).toBe(450);
  });

  it("o filtro encontra as que estavam fora das primeiras", () => {
    const { shown, matching } = visibleLines(lines, {}, "proposta 1037", label, 100);
    expect(matching).toBe(6);
    expect(shown.map((l) => l.objectId)).toEqual(["p444", "p445", "p446", "p447", "p448", "p449"]);
  });

  it("uma linha que já recebeu valor nunca some, mesmo fora do filtro e do limite", () => {
    const { shown } = visibleLines(lines, { p449: "2500" }, "proposta 1000", label, 100);
    expect(shown.map((l) => l.objectId)).toContain("p449");
    expect(shown).toHaveLength(13);
  });
});
