import { describe, it, expect, beforeEach } from "vitest";
import { ImportPartiesUseCase } from "../../../core/application/use-cases/ImportParties";
import { InMemoryPartyRepository } from "../../../infra/persistence/InMemoryPartyRepository";
import { AttributeSource } from "../../../core/domain/enums/AttributeSource";
import { AttributeState } from "../../../core/domain/enums/AttributeState";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";
import { PartyAttributeKey } from "../../../core/domain/value-objects/PartyAttribute";
import type { PartySeed, PartySeedSource } from "../../../core/application/ports/PartySeedSource";
import type { Clock } from "../../../core/application/ports/Clock";

const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

function source(system: string, seeds: PartySeed[]): PartySeedSource {
  return { system, fetch: async () => seeds };
}

let repo: InMemoryPartyRepository;
let importParties: ImportPartiesUseCase;

beforeEach(() => {
  repo = new InMemoryPartyRepository();
  importParties = new ImportPartiesUseCase(repo, clock);
});

describe("ImportParties — creating", () => {
  it("creates an identified party from a seed", async () => {
    const result = await importParties.execute(
      source("erp", [{ partyId: "party-alfa", displayName: "Fornecedor Alfa" }]),
    );

    expect(result).toMatchObject({ system: "erp", seen: 1, created: 1, enriched: 0, unchanged: 0 });
    const party = await repo.findById("party-alfa");
    expect(party?.identityState).toBe(PartyIdentityState.IDENTIFIED);
    expect(party?.displayName).toBe("Fornecedor Alfa");
  });

  it("records document and type as imported attributes with provenance", async () => {
    await importParties.execute(
      source("erp", [
        { partyId: "party-alfa", displayName: "Alfa", document: "12.345.678/0001-99", type: "supplier" },
      ]),
    );

    const party = await repo.findById("party-alfa");
    expect(party?.attributes[PartyAttributeKey.DOCUMENT]).toMatchObject({
      state: AttributeState.KNOWN,
      value: "12.345.678/0001-99",
      source: AttributeSource.IMPORT,
      capturedBy: "erp",
      capturedAt: "2026-08-03T00:00:00.000Z",
    });
    expect(party?.attributes[PartyAttributeKey.TYPE]?.value).toBe("supplier");
  });

  it("leaves an unstated attribute absent rather than defaulting it", async () => {
    await importParties.execute(source("erp", [{ partyId: "party-alfa", displayName: "Alfa" }]));
    const party = await repo.findById("party-alfa");
    expect(party?.attributes[PartyAttributeKey.DOCUMENT]).toBeUndefined();
  });

  it("drops an alias that is only a spelling of the display name", async () => {
    await importParties.execute(
      source("erp", [{ partyId: "party-alfa", displayName: "Alfa", aliases: ["ALFA Ltda.", "Alfa Comercio"] }]),
    );
    expect((await repo.findById("party-alfa"))?.aliases).toEqual(["Alfa Comercio"]);
  });
});

describe("ImportParties — enriching an existing party", () => {
  beforeEach(async () => {
    await importParties.execute(
      source("ledger", [{ partyId: "party-alfa", displayName: "Fornecedor Alfa" }]),
    );
  });

  it("keeps the existing display name and files a differing one as an alias", async () => {
    const result = await importParties.execute(
      source("erp", [{ partyId: "party-alfa", displayName: "Alfa Comercio Ltda" }]),
    );

    expect(result).toMatchObject({ created: 0, enriched: 1, aliasesAdded: 1 });
    const party = await repo.findById("party-alfa");
    expect(party?.displayName).toBe("Fornecedor Alfa");
    expect(party?.aliases).toEqual(["Alfa Comercio Ltda"]);
  });

  it("fills an absent attribute", async () => {
    await importParties.execute(
      source("erp", [{ partyId: "party-alfa", displayName: "Fornecedor Alfa", document: "12345678000199" }]),
    );
    expect((await repo.findById("party-alfa"))?.attributes[PartyAttributeKey.DOCUMENT]?.value)
      .toBe("12345678000199");
  });

  it("never overwrites an attribute that is already known", async () => {
    await importParties.execute(
      source("erp", [{ partyId: "party-alfa", displayName: "Fornecedor Alfa", document: "11111111111111" }]),
    );
    await importParties.execute(
      source("crm", [{ partyId: "party-alfa", displayName: "Fornecedor Alfa", document: "22222222222222" }]),
    );

    const document = (await repo.findById("party-alfa"))?.attributes[PartyAttributeKey.DOCUMENT];
    expect(document?.value).toBe("11111111111111");
    expect(document?.capturedBy).toBe("erp");
  });

  it("adds external ids per originating system", async () => {
    await importParties.execute(
      source("erp", [
        { partyId: "party-alfa", displayName: "Fornecedor Alfa", externalIds: [{ system: "erp", value: "F-001" }] },
      ]),
    );
    await importParties.execute(
      source("crm", [
        { partyId: "party-alfa", displayName: "Fornecedor Alfa", externalIds: [{ system: "crm", value: "F-001" }] },
      ]),
    );

    expect((await repo.findById("party-alfa"))?.externalIds).toEqual([
      { system: "erp", value: "F-001" },
      { system: "crm", value: "F-001" },
    ]);
  });
});

describe("ImportParties — invariants", () => {
  it("is idempotent: re-running the same source changes nothing", async () => {
    const seeds: PartySeed[] = [
      { partyId: "party-alfa", displayName: "Fornecedor Alfa", document: "12345678000199" },
      { partyId: "party-beta", displayName: "Beta Servicos", aliases: ["Beta"] },
    ];

    const first = await importParties.execute(source("erp", seeds));
    const snapshot = JSON.stringify(await repo.findAll());
    const second = await importParties.execute(source("erp", seeds));

    expect(first).toMatchObject({ created: 2, enriched: 0, unchanged: 0 });
    expect(second).toMatchObject({ created: 0, enriched: 0, unchanged: 2 });
    expect(JSON.stringify(await repo.findAll())).toBe(snapshot);
  });

  it("mints no id — every party in the directory came from a seed", async () => {
    await importParties.execute(
      source("erp", [
        { partyId: "party-alfa", displayName: "Alfa" },
        { partyId: "ACME Foods", displayName: "ACME Foods" },
      ]),
    );

    const ids = (await repo.findAll()).map((p) => p.partyId).sort();
    expect(ids).toEqual(["ACME Foods", "party-alfa"]);
  });

  it("accepts an empty source without inventing anything", async () => {
    const result = await importParties.execute(source("erp", []));
    expect(result).toMatchObject({ seen: 0, created: 0 });
    expect(await repo.findAll()).toEqual([]);
  });
});
