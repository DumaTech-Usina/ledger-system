import { describe, it, expect } from "vitest";
import { canonicalOf, identifiersOf, readThroughLinks } from "../../../core/domain/services/IdentityMapping";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";
import type { Party } from "../../../core/domain/entities/Party";
import type { IdentityLink } from "../../../core/domain/value-objects/IdentityLink";

const link = (fromIdentifier: string, toPartyId: string): IdentityLink => ({
  id: `l-${fromIdentifier}`,
  fromIdentifier,
  toPartyId,
  linkedBy: "cfo",
  linkedAt: "2026-11-06T12:00:00.000Z",
});

const party = (partyId: string, displayName: string, identityState = PartyIdentityState.IDENTIFIED): Party => ({
  partyId,
  displayName,
  identityState,
  aliases: [],
  externalIds: [],
  attributes: {},
});

describe("canonicalOf", () => {
  it("an identifier with no link is its own answer", () => {
    expect(canonicalOf("a", [])).toBe("a");
  });

  it("follows a link, and a chain of them", () => {
    expect(canonicalOf("a", [link("a", "b"), link("b", "c")])).toBe("c");
  });

  it("stops on a cycle instead of hanging", () => {
    expect(["a", "b"]).toContain(canonicalOf("a", [link("a", "b"), link("b", "a")]));
  });
});

describe("identifiersOf — REQ-332", () => {
  const links = [link("Fornecedor Alfa", "alfa"), link("ALFA LTDA", "alfa"), link("prov-123", "alfa"), link("x", "outra")];

  it("gives every identifier the party is known by, its own first", () => {
    expect(identifiersOf("alfa", links)).toEqual(["alfa", "Fornecedor Alfa", "ALFA LTDA", "prov-123"]);
  });

  it("asked by a linked identifier, gives the same answer", () => {
    expect(identifiersOf("prov-123", links)).toEqual(identifiersOf("alfa", links));
  });

  it("a party with no links is known only by its id", () => {
    expect(identifiersOf("sozinha", links)).toEqual(["sozinha"]);
  });
});

describe("readThroughLinks", () => {
  const provisional = party("prov-1", "M. Souza", PartyIdentityState.PROVISIONAL);
  const maria = party("maria", "Maria Souza");

  it("sem ligações, lê como está guardado", () => {
    expect(readThroughLinks([provisional, maria], [])).toEqual([provisional, maria]);
  });

  it("uma identidade ligada é lida como a parte, com o nome da parte", () => {
    const [read] = readThroughLinks([provisional, maria], [link("prov-1", "maria")]);

    expect(read).toMatchObject({
      partyId: "prov-1",
      identityState: PartyIdentityState.MERGED,
      mergedInto: "maria",
      displayName: "Maria Souza",
    });
  });

  it("um identificador sem linha própria vira um apelido da parte", () => {
    const [read] = readThroughLinks([maria], [link("MARIA S.", "maria")]);

    expect(read.aliases).toEqual(["MARIA S."]);
  });

  it("não altera o que recebeu", () => {
    const stored = [provisional, maria];
    const before = JSON.stringify(stored);

    readThroughLinks(stored, [link("prov-1", "maria")]);

    expect(JSON.stringify(stored)).toBe(before);
  });
});
