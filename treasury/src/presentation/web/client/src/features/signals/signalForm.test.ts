import { describe, it, expect } from "vitest";
import { canDismiss, isOpenProposal, missingRequired, signalPayload } from "./signalForm";

describe("signalPayload — o que sai do formulário do sinal", () => {
  it("valores pela máscara em centavos, percentual com vírgula, sem campos vazios", () => {
    expect(
      signalPayload("eligibility", {
        policyId: " 5177 ",
        usinaValue: "12877",
        payout: "7726",
        cr: "60,5",
        eligibleAt: "2026-10-21",
        signedBy: "",
      }),
    ).toEqual({ policyId: "5177", usinaValue: "128.77", payout: "77.26", cr: "60.5", eligibleAt: "2026-10-21" });
  });

  it("campos de outro tipo de sinal não saem", () => {
    expect(signalPayload("policy", { policyId: "1", usinaValue: "100", registeredAt: "2026-10-01", payout: "50" })).toEqual({
      policyId: "1",
      usinaValue: "1.00",
      registeredAt: "2026-10-01",
    });
  });
});

describe("missingRequired", () => {
  it("lista os obrigatórios em branco de cada tipo", () => {
    expect(missingRequired("eligibility", { policyId: "1" })).toEqual(["usinaValue", "payout", "eligibleAt"]);
    expect(missingRequired("policy", { policyId: "1", usinaValue: "1", registeredAt: "2026-10-01" })).toEqual([]);
  });
});

describe("isOpenProposal", () => {
  it("só reabre o que ainda espera o usuário", () => {
    expect(["gathering", "awaiting_confirmation", "awaiting_correction"].every(isOpenProposal)).toBe(true);
    expect(["accepted", "rejected", "dismissed", null].some((s) => isOpenProposal(s))).toBe(false);
  });
});

describe("§4.7 — parcela do sistema de saúde", () => {
  it("um valor zerado sai como 0.00: no corretor ou no supervisor, ele diz alguma coisa (REQ-286)", () => {
    expect(
      signalPayload("installment", {
        proposalNumber: "48213",
        installment: "3",
        usinaValue: "2500",
        brokerValue: "2000",
        supervisorValue: "0",
        taxRate: "6,5",
        dischargedAt: "2026-11-05",
        owedValue: "",
      }),
    ).toEqual({
      proposalNumber: "48213",
      installment: "3",
      usinaValue: "25.00",
      brokerValue: "20.00",
      supervisorValue: "0.00",
      taxRate: "6.5",
      dischargedAt: "2026-11-05",
    });
  });

  it("obrigatórios: proposta, parcela, baixado, corretor e data da baixa", () => {
    expect(missingRequired("installment", {})).toEqual(["proposalNumber", "installment", "usinaValue", "brokerValue", "dischargedAt"]);
  });

  it("REQ-286: só uma obrigação que ainda espera o usuário pode ser declarada inexistente", () => {
    expect(canDismiss({ fact: "commission_obligation", intentStatus: "awaiting_confirmation" })).toBe(true);
    expect(canDismiss({ fact: "supervisor_obligation", intentStatus: "gathering" })).toBe(true);
    expect(canDismiss({ fact: "commission_expected", intentStatus: "awaiting_confirmation" })).toBe(false);
    expect(canDismiss({ fact: "supervisor_obligation", intentStatus: "accepted" })).toBe(false);
    expect(canDismiss({ fact: "supervisor_obligation", intentStatus: "dismissed" })).toBe(false);
  });
});
