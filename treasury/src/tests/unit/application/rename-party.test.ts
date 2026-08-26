import { describe, it, expect } from "vitest";
import { RenamePartyUseCase } from "../../../core/application/use-cases/RenameParty";
import { InMemoryPartyRepository } from "../../../infra/persistence/InMemoryPartyRepository";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";
import type { Party } from "../../../core/domain/entities/Party";

async function wire(existing: Party) {
  const repo = new InMemoryPartyRepository();
  await repo.save(existing);
  return { repo, useCase: new RenamePartyUseCase(repo) };
}

const ACME: Party = {
  partyId: "party-acme",
  identityState: PartyIdentityState.IDENTIFIED,
  displayName: "ACME Ltda",
  aliases: ["ACME"],
  externalIds: [],
  attributes: {},
};

describe("RenameParty", () => {
  it("updates the display name and returns it", async () => {
    const { repo, useCase } = await wire(ACME);

    const result = await useCase.execute({ partyId: "party-acme", displayName: "ACME Distribuidora Ltda" });

    expect(result).toEqual({ partyId: "party-acme", displayName: "ACME Distribuidora Ltda" });
    const stored = await repo.findById("party-acme");
    expect(stored?.displayName).toBe("ACME Distribuidora Ltda");
  });

  it("trims surrounding whitespace", async () => {
    const { repo, useCase } = await wire(ACME);

    await useCase.execute({ partyId: "party-acme", displayName: "  ACME Distribuidora  " });

    expect((await repo.findById("party-acme"))?.displayName).toBe("ACME Distribuidora");
  });

  it("never touches the party id, aliases, or any other field", async () => {
    const { repo, useCase } = await wire(ACME);

    await useCase.execute({ partyId: "party-acme", displayName: "Novo Nome" });

    const stored = await repo.findById("party-acme");
    expect(stored?.partyId).toBe("party-acme");
    expect(stored?.aliases).toEqual(["ACME"]);
  });

  it("rejects a blank name without touching the stored party", async () => {
    const { repo, useCase } = await wire(ACME);

    await expect(useCase.execute({ partyId: "party-acme", displayName: "   " })).rejects.toThrow(/em branco/i);
    expect((await repo.findById("party-acme"))?.displayName).toBe("ACME Ltda");
  });

  it("throws on an unknown party", async () => {
    const { useCase } = await wire(ACME);

    await expect(useCase.execute({ partyId: "party-does-not-exist", displayName: "X" })).rejects.toThrow(/Unknown party/);
  });
});
