import { describe, it, expect } from "vitest";
import { isOpenProposal, missingRequired, signalPayload } from "./signalForm";

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
    expect(["accepted", "rejected", null].some((s) => isOpenProposal(s))).toBe(false);
  });
});
