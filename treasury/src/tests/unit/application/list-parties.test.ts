import { describe, it, expect } from "vitest";
import { ListPartiesUseCase } from "../../../core/application/use-cases/ListParties";
import { PartyDirectory } from "../../../core/application/services/PartyDirectory";
import { InMemoryPartyRepository } from "../../../infra/persistence/InMemoryPartyRepository";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";
import { AttributeState } from "../../../core/domain/enums/AttributeState";
import { AttributeSource } from "../../../core/domain/enums/AttributeSource";
import { PartyAttributeKey } from "../../../core/domain/value-objects/PartyAttribute";
import type { Party } from "../../../core/domain/entities/Party";

const USINA_ID = "party-usina";

function party(overrides: Partial<Party> & Pick<Party, "partyId" | "displayName">): Party {
  return {
    identityState: PartyIdentityState.IDENTIFIED,
    aliases: [],
    externalIds: [],
    attributes: {},
    ...overrides,
  };
}

async function wire(parties: Party[]) {
  const repo = new InMemoryPartyRepository();
  for (const p of parties) await repo.save(p);
  const directory = new PartyDirectory(repo);
  return new ListPartiesUseCase(directory, USINA_ID);
}

describe("ListParties", () => {
  it("lists registered counterparties, sorted by display name", async () => {
    const useCase = await wire([
      party({ partyId: "party-zeta", displayName: "Zeta Distribuidora" }),
      party({ partyId: "party-acme", displayName: "ACME" }),
    ]);

    const { parties } = await useCase.execute();

    expect(parties.map((p) => p.displayName)).toEqual(["ACME", "Zeta Distribuidora"]);
  });

  it("excludes the usina's own party record — it is who 'we' are, never a counterparty", async () => {
    const useCase = await wire([
      party({ partyId: USINA_ID, displayName: "Usina" }),
      party({ partyId: "party-acme", displayName: "ACME" }),
    ]);

    const { parties } = await useCase.execute();

    expect(parties.map((p) => p.partyId)).toEqual(["party-acme"]);
  });

  it("excludes a party merged into another — it answers for its survivor, not as its own row", async () => {
    const useCase = await wire([
      party({ partyId: "party-old", displayName: "ACME Ltda (old)", identityState: PartyIdentityState.MERGED, mergedInto: "party-acme" }),
      party({ partyId: "party-acme", displayName: "ACME" }),
    ]);

    const { parties } = await useCase.execute();

    expect(parties.map((p) => p.partyId)).toEqual(["party-acme"]);
  });

  it("surfaces a KNOWN document but never a DECLINED or unset one", async () => {
    const useCase = await wire([
      party({
        partyId: "party-acme",
        displayName: "ACME",
        attributes: {
          [PartyAttributeKey.DOCUMENT]: {
            state: AttributeState.KNOWN,
            value: "12.345.678/0001-90",
            source: AttributeSource.USER,
            confidence: 1,
            capturedAt: "2026-07-23T00:00:00.000Z",
          },
        },
      }),
      party({
        partyId: "party-broker",
        displayName: "Corretor Parceiro",
        attributes: {
          [PartyAttributeKey.DOCUMENT]: {
            state: AttributeState.DECLINED,
            source: AttributeSource.USER,
            confidence: 1,
            capturedAt: "2026-07-23T00:00:00.000Z",
          },
        },
      }),
      party({ partyId: "party-other", displayName: "Sem documento" }),
    ]);

    const { parties } = await useCase.execute();
    const byId = Object.fromEntries(parties.map((p) => [p.partyId, p]));

    expect(byId["party-acme"].document).toBe("12.345.678/0001-90");
    expect(byId["party-broker"].document).toBeUndefined();
    expect(byId["party-other"].document).toBeUndefined();
  });

  it("returns an empty list when the directory holds nothing but the usina", async () => {
    const useCase = await wire([party({ partyId: USINA_ID, displayName: "Usina" })]);

    const { parties } = await useCase.execute();

    expect(parties).toEqual([]);
  });
});
