import { describe, it, expect } from "vitest";
import { ProposalContextNormalizer } from "../../../core/application/services/ProposalContextNormalizer";
import { ProposalContextInput } from "../../../core/application/dtos/ProposalContextInput";

function makeInput(overrides: Partial<ProposalContextInput> = {}): ProposalContextInput {
  return {
    proposalId: "prop-abc-123",
    proposalNumber: "12345678",
    operatorId: "op-001",
    registeredAt: "2024-03-15T10:00:00Z",
    ...overrides,
  };
}

describe("ProposalContextJob — proposal normalization at the ETL intake gate", () => {

  it("an empty batch produces no contexts — there is nothing to normalize when no proposals arrived from the source system", () => {
    const job = new ProposalContextNormalizer();
    expect(job.normalize([])).toHaveLength(0);
  });

  it("a complete, well-formed proposal entry becomes a canonical ProposalContext with every field mapped to the correct position", () => {
    const job = new ProposalContextNormalizer();
    const [ctx] = job.normalize([
      makeInput({
        proposalId: "prop-xyz",
        proposalNumber: "98765432",
        operatorId: "op-007",
        brokerId: "bkr-101",
        supervisorId: "sup-999",
        registeredAt: "2024-06-01T08:30:00Z",
      }),
    ]);

    expect(ctx.proposalId).toBe("prop-xyz");
    expect(ctx.proposalNumber).toBe("98765432");
    expect(ctx.operatorId).toBe("op-007");
    expect(ctx.brokerId).toBe("bkr-101");
    expect(ctx.supervisorId).toBe("sup-999");
    expect(ctx.registeredAt).toEqual(new Date("2024-06-01T08:30:00Z"));
  });

  it("optional fields not present in the source record default to null — the context is still valid and usable downstream", () => {
    const job = new ProposalContextNormalizer();
    const [ctx] = job.normalize([makeInput()]);

    expect(ctx.brokerId).toBeNull();
    expect(ctx.supervisorId).toBeNull();
  });

  it("a proposal with no proposalId is silently dropped — the system cannot correlate receipt events to a proposal without a stable identity anchor", () => {
    const job = new ProposalContextNormalizer();
    const result = job.normalize([makeInput({ proposalId: undefined as unknown as string })]);
    expect(result).toHaveLength(0);
  });

  it("a proposal with a blank proposalId string is dropped — whitespace-only strings do not constitute valid identifiers in the financial domain", () => {
    const job = new ProposalContextNormalizer();
    const result = job.normalize([makeInput({ proposalId: "   " })]);
    expect(result).toHaveLength(0);
  });

  it("a proposal with no operatorId is dropped — commission receipts cannot be attributed without knowing who originated the proposal", () => {
    const job = new ProposalContextNormalizer();
    const result = job.normalize([makeInput({ operatorId: undefined as unknown as string })]);
    expect(result).toHaveLength(0);
  });

  it("a proposal with no proposalNumber is dropped — downstream installment matching and position correlation depend on a structured proposal number", () => {
    const job = new ProposalContextNormalizer();
    const result = job.normalize([makeInput({ proposalNumber: undefined as unknown as string })]);
    expect(result).toHaveLength(0);
  });

  it("a proposal with an unparseable registeredAt date is dropped — temporal ordering of commission events requires valid timestamps", () => {
    const job = new ProposalContextNormalizer();
    const result = job.normalize([makeInput({ registeredAt: "not-a-date" })]);
    expect(result).toHaveLength(0);
  });

  it("when the same proposalId appears twice in a batch, only the first entry is kept — the second entry is a duplicate and the system protects against double-crediting the same proposal", () => {
    const job = new ProposalContextNormalizer();
    const first  = makeInput({ proposalId: "dup-001", proposalNumber: "11111111", operatorId: "op-A" });
    const second = makeInput({ proposalId: "dup-001", proposalNumber: "22222222", operatorId: "op-B" });

    const result = job.normalize([first, second]);

    expect(result).toHaveLength(1);
    expect(result[0].operatorId).toBe("op-A");
  });

  it("a mixed batch containing valid and invalid entries produces only the valid contexts — corrupt rows are quarantined at the intake gate without contaminating clean data", () => {
    const job = new ProposalContextNormalizer();
    const inputs = [
      makeInput({ proposalId: "good-1" }),
      makeInput({ proposalId: "" }),                                   // blank id
      makeInput({ proposalId: "good-2", operatorId: "" }),            // blank operatorId
      makeInput({ proposalId: "good-3" }),
      makeInput({ proposalId: "bad-date", registeredAt: "NaN" }),     // unparseable date
    ];

    const result = job.normalize(inputs);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.proposalId)).toEqual(["good-1", "good-3"]);
  });

});
