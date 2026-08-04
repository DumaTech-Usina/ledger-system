import { describe, it, expect, beforeEach } from "vitest";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { LedgerPartySweepSource } from "../../infra/seeding/LedgerPartySweepSource";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { ImportPartiesUseCase } from "../../core/application/use-cases/ImportParties";
import { MeasureResolutionUseCase } from "../../core/application/use-cases/MeasureResolution";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { ResolutionRule } from "../../core/domain/services/PartyResolution";
import type { Clock } from "../../core/application/ports/Clock";
import { PARTY } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };
const USINA = PARTY.USINA;

/** The stub Ledger names four counterparties, every one of them a free-text literal. */
const LEDGER_LITERALS = ["ACME Foods", "Fornecedor Sul", "Grão Verde", "corretor"];

let repo: InMemoryPartyRepository;
let directory: PartyDirectory;
let importParties: ImportPartiesUseCase;
let measure: MeasureResolutionUseCase;

beforeEach(async () => {
  repo = new InMemoryPartyRepository();
  directory = new PartyDirectory(repo);
  importParties = new ImportPartiesUseCase(repo, clock);
  measure = new MeasureResolutionUseCase(directory);

  await importParties.execute(new LedgerPartySweepSource(new StubLedgerReadAdapter(), USINA));
});

describe("Ledger sweep", () => {
  it("adopts every party id already present in the book, plus the usina", async () => {
    const ids = (await directory.list()).map((p) => p.partyId).sort();
    expect(ids).toEqual([...LEDGER_LITERALS, USINA].sort());
  });

  it("adopts the literal as the id rather than minting a new one — the join must keep working", async () => {
    const party = await directory.get("ACME Foods");
    expect(party?.partyId).toBe("ACME Foods");
    expect(party?.displayName).toBe("ACME Foods");
  });

  it("is idempotent — sweeping twice does not duplicate", async () => {
    const before = (await directory.list()).length;
    const second = await importParties.execute(
      new LedgerPartySweepSource(new StubLedgerReadAdapter(), USINA),
    );
    expect(second.created).toBe(0);
    expect((await directory.list()).length).toBe(before);
  });
});

describe("Legacy convergence", () => {
  it("resolves every historical literal exactly, with no turn spent", async () => {
    for (const literal of LEDGER_LITERALS) {
      const resolution = await directory.resolve({ mention: literal });
      expect(resolution.kind).toBe("resolved");
      if (resolution.kind === "resolved") {
        expect(resolution.partyId).toBe(literal);
        expect(resolution.needsConfirmation).toBe(false);
      }
    }
  });

  it("resolves the spelling variations that fragment identity today", async () => {
    // These four strings are four distinct entities in the book. Against the seeded Directory they
    // all name the same one — which is the whole point of seeding before anything else changes.
    // The literal itself matches on rung 1 (the adopted id); the variations match on rung 4.
    const expected: [string, ResolutionRule][] = [
      ["ACME Foods", ResolutionRule.EXACT_ID],
      ["acme foods", ResolutionRule.EXACT_NAME],
      ["ACME FOODS", ResolutionRule.EXACT_NAME],
      ["Acme Foods Ltda.", ResolutionRule.EXACT_NAME],
    ];

    for (const [variation, rule] of expected) {
      const resolution = await directory.resolve({ mention: variation });
      expect(resolution.kind).toBe("resolved");
      if (resolution.kind === "resolved") {
        expect(resolution.partyId).toBe("ACME Foods");
        expect(resolution.rule).toBe(rule);
        expect(resolution.needsConfirmation).toBe(false);
      }
    }
  });

  it("converges an accented literal typed without accents", async () => {
    const resolution = await directory.resolve({ mention: "Grao Verde" });
    expect(resolution.kind).toBe("resolved");
    if (resolution.kind === "resolved") expect(resolution.partyId).toBe("Grão Verde");
  });
});

describe("Measurement — the number that gates the barrier", () => {
  it("reports the outcome distribution over a corpus of mentions", async () => {
    const measurement = await measure.execute([
      ...LEDGER_LITERALS, // exact
      "acme foods", // exact after normalization
      "Empresa Nova", // nothing matches
    ]);

    expect(measurement.total).toBe(6);
    expect(measurement.exact).toBe(5);
    expect(measurement.ambiguous).toBe(0);
    expect(measurement.unresolved).toBe(1);
    expect(measurement.unresolvedSamples).toEqual(["Empresa Nova"]);
  });

  it("counts a similarity hit as needing confirmation, not as free", async () => {
    const measurement = await measure.execute(["Fornecedor Sol"]); // one edit from "Fornecedor Sul"
    expect(measurement.exact).toBe(0);
    expect(measurement.needsConfirmation).toBe(1);
  });

  it("reports an empty directory as fully unresolved instead of failing", async () => {
    const empty = new MeasureResolutionUseCase(new PartyDirectory(new InMemoryPartyRepository()));
    const measurement = await empty.execute(LEDGER_LITERALS);
    expect(measurement.unresolved).toBe(4);
    expect(measurement.exact).toBe(0);
  });
});

describe("Seeding changes no behaviour", () => {
  it("resolves without creating anything — the directory is unchanged by measurement", async () => {
    const before = JSON.stringify(await directory.list());
    await measure.execute(["Empresa Nova", "Outra Coisa", "ACME Foods"]);
    expect(JSON.stringify(await directory.list())).toBe(before);
  });
});
