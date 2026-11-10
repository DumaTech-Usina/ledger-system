import { describe, it, expect } from "vitest";
import { FILLED_EXAMPLE_FLAG, seedsFor } from "../../../infra/dev/devSeeds";

describe("dev Ledger seeds", () => {
  const example = ["a", "b"];

  it("starts empty without the flag", () => {
    expect(seedsFor(["node", "run-dev.ts"], example)).toEqual([]);
  });

  it("loads the example with --filled-example", () => {
    expect(seedsFor(["node", "run-dev.ts", FILLED_EXAMPLE_FLAG], example)).toEqual(["a", "b"]);
  });

  it("does not hand out the example array itself", () => {
    expect(seedsFor([FILLED_EXAMPLE_FLAG], example)).not.toBe(example);
  });
});
