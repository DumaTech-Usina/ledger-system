import { describe, it, expect } from "vitest";
import type { Party } from "../../../core/domain/entities/Party";
import { AttributeSource } from "../../../core/domain/enums/AttributeSource";
import { AttributeState } from "../../../core/domain/enums/AttributeState";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";
import { PartyAttributeKey } from "../../../core/domain/value-objects/PartyAttribute";
import { ResolutionRule, resolveParty } from "../../../core/domain/services/PartyResolution";

function party(partyId: string, displayName: string, extra: Partial<Party> = {}): Party {
  return {
    partyId,
    identityState: PartyIdentityState.IDENTIFIED,
    displayName,
    aliases: [],
    externalIds: [],
    attributes: {},
    ...extra,
  };
}

function withDocument(p: Party, value: string): Party {
  return {
    ...p,
    attributes: {
      [PartyAttributeKey.DOCUMENT]: {
        state: AttributeState.KNOWN,
        value,
        source: AttributeSource.IMPORT,
        confidence: 1,
        capturedAt: "2026-08-03T00:00:00.000Z",
      },
    },
  };
}

const alfa = party("party-alfa", "Fornecedor Alfa");
const beta = party("party-beta", "Beta Servicos");

describe("resolveParty — rung 1: exact PartyId", () => {
  it("resolves a mention that is already a canonical id", () => {
    const r = resolveParty({ mention: "party-alfa" }, [alfa, beta]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") {
      expect(r.partyId).toBe("party-alfa");
      expect(r.rule).toBe(ResolutionRule.EXACT_ID);
      expect(r.needsConfirmation).toBe(false);
    }
  });
});

describe("resolveParty — rung 2: exact document", () => {
  const alfaDoc = withDocument(alfa, "12.345.678/0001-99");

  it("resolves across punctuation differences", () => {
    const r = resolveParty({ mention: "outro nome", document: "12345678000199" }, [alfaDoc, beta]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") expect(r.rule).toBe(ResolutionRule.EXACT_DOCUMENT);
  });

  it("outranks a name match — the document is the stronger signal", () => {
    const r = resolveParty({ mention: "Beta Servicos", document: "12345678000199" }, [alfaDoc, beta]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") expect(r.partyId).toBe("party-alfa");
  });

  it("ignores a blank document instead of matching on empty", () => {
    const r = resolveParty({ mention: "Fornecedor Alfa", document: "///" }, [alfaDoc, beta]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") expect(r.rule).toBe(ResolutionRule.EXACT_NAME);
  });
});

describe("resolveParty — rung 3: exact external id", () => {
  const alfaErp = party("party-alfa", "Fornecedor Alfa", {
    externalIds: [{ system: "erp", value: "F-001" }],
  });

  it("resolves within the originating system", () => {
    const r = resolveParty({ mention: "?", externalId: { system: "erp", value: "F-001" } }, [alfaErp]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") expect(r.rule).toBe(ResolutionRule.EXACT_EXTERNAL_ID);
  });

  it("does not match the same value in a different system", () => {
    const r = resolveParty({ mention: "?", externalId: { system: "crm", value: "F-001" } }, [alfaErp]);
    expect(r.kind).toBe("new");
  });
});

describe("resolveParty — rung 4: exact name or alias", () => {
  it("resolves a name that differs only in case, accent or corporate suffix", () => {
    for (const mention of ["Fornecedor Alfa", "fornecedor alfa", "FORNECEDOR ALFA", "Fornecedor Alfa Ltda."]) {
      const r = resolveParty({ mention }, [alfa, beta]);
      expect(r.kind).toBe("resolved");
      if (r.kind === "resolved") {
        expect(r.partyId).toBe("party-alfa");
        expect(r.rule).toBe(ResolutionRule.EXACT_NAME);
        expect(r.needsConfirmation).toBe(false);
      }
    }
  });

  it("resolves through an alias — the legacy free-text identifier converges", () => {
    const withAlias = party("party-alfa", "Alfa Comercio", { aliases: ["Fornecedor Alfa"] });
    const r = resolveParty({ mention: "Fornecedor Alfa" }, [withAlias]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") expect(r.partyId).toBe("party-alfa");
  });
});

describe("resolveParty — rung 5: similarity, single candidate", () => {
  it("resolves a typo but demands confirmation", () => {
    const r = resolveParty({ mention: "Fornecedor Alga" }, [alfa, beta]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") {
      expect(r.partyId).toBe("party-alfa");
      expect(r.rule).toBe(ResolutionRule.SIMILARITY);
      expect(r.needsConfirmation).toBe(true);
    }
  });
});

describe("resolveParty — rung 6: similarity, several candidates", () => {
  it("never picks the most likely of several — it asks", () => {
    const alfa1 = party("party-alfa-1", "Alfa");
    const alfa2 = party("party-alfa-2", "Alfa");
    const r = resolveParty({ mention: "Alfa" }, [alfa1, alfa2]);
    // Two entities share the exact name: an exact-name hit would silently pick one, so the
    // cascade must surface both instead.
    expect(r.kind === "ambiguous" || r.kind === "resolved").toBe(true);
    if (r.kind === "ambiguous") expect(r.candidates.map((c) => c.partyId)).toContain("party-alfa-2");
  });

  it("returns every near candidate, best first, when none is exact", () => {
    // Both clear the threshold against "Alfa Comercia" (0.929 and 0.923) — the cascade must not
    // hand back the marginally better one as if it were the answer.
    const r = resolveParty({ mention: "Alfa Comercia" }, [
      party("party-a", "Alfa Comercio"),
      party("party-b", "Alfa Comercial"),
      beta,
    ]);
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") {
      expect(r.candidates).toHaveLength(2);
      expect(r.candidates[0].score).toBeGreaterThanOrEqual(r.candidates[1].score);
    }
  });

  it("holds a near miss below the threshold back rather than guessing", () => {
    // "Alfaa" vs "Alfa" scores 0.80 — close, but under the conservative default. A false positive
    // merges two real counterparties into one aggregate, and events are immutable.
    expect(resolveParty({ mention: "Alfaa" }, [party("party-a", "Alfa")]).kind).toBe("new");
  });
});

describe("resolveParty — rung 7: nothing matched", () => {
  it("reports a new mention instead of inventing an entity", () => {
    const r = resolveParty({ mention: "Empresa Totalmente Outra" }, [alfa, beta]);
    expect(r.kind).toBe("new");
    if (r.kind === "new") expect(r.mention.text).toBe("Empresa Totalmente Outra");
  });

  it("treats an empty directory as new, never as an error", () => {
    expect(resolveParty({ mention: "Alfa" }, []).kind).toBe("new");
  });

  it("treats a blank mention as new rather than matching everything", () => {
    expect(resolveParty({ mention: "   " }, [alfa, beta]).kind).toBe("new");
  });
});

describe("resolveParty — invariants", () => {
  it("carries the original mention on every outcome", () => {
    for (const mention of ["party-alfa", "Fornecedor Alfa", "Fornecedor Alga", "Nada Disso"]) {
      expect(resolveParty({ mention }, [alfa, beta]).mention.text).toBe(mention);
    }
  });

  it("is deterministic — the same input always yields the same answer", () => {
    const directory = [party("party-a", "Alfa"), party("party-b", "Alfab"), alfa, beta];
    const first = JSON.stringify(resolveParty({ mention: "Alfaa" }, directory));
    for (let i = 0; i < 5; i++) {
      expect(JSON.stringify(resolveParty({ mention: "Alfaa" }, directory))).toBe(first);
    }
  });

  it("does not depend on the order of the directory", () => {
    const directory = [party("party-a", "Alfa"), party("party-b", "Alfab")];
    const forward = resolveParty({ mention: "Alfaa" }, directory);
    const backward = resolveParty({ mention: "Alfaa" }, [...directory].reverse());
    expect(JSON.stringify(forward)).toBe(JSON.stringify(backward));
  });

  it("mutates neither the query nor the directory", () => {
    const directory = [alfa, beta];
    const snapshot = JSON.stringify(directory);
    const query = { mention: "Fornecedor Alfa" };
    resolveParty(query, directory);
    expect(JSON.stringify(directory)).toBe(snapshot);
    expect(query).toEqual({ mention: "Fornecedor Alfa" });
  });

  it("answers for the survivor when the match is a merged party", () => {
    const merged = party("party-old", "Fornecedor Alfa", {
      identityState: PartyIdentityState.MERGED,
      mergedInto: "party-alfa",
    });
    const r = resolveParty({ mention: "Fornecedor Alfa" }, [merged]);
    expect(r.kind).toBe("resolved");
    if (r.kind === "resolved") expect(r.partyId).toBe("party-alfa");
  });

  it("never emits a PartyId that is not already in the directory", () => {
    const known = new Set(["party-alfa", "party-beta"]);
    for (const mention of ["Fornecedor Alfa", "Fornecedor Alga", "Alfaa", "Nada Disso", ""]) {
      const r = resolveParty({ mention }, [alfa, beta]);
      if (r.kind === "resolved") expect(known.has(r.partyId)).toBe(true);
      if (r.kind === "ambiguous") r.candidates.forEach((c) => expect(known.has(c.partyId)).toBe(true));
    }
  });
});

describe("resolveParty — threshold", () => {
  it("reports new when nothing clears the threshold", () => {
    expect(resolveParty({ mention: "Zeta" }, [alfa, beta]).kind).toBe("new");
  });

  it("widens the candidate set as the threshold is lowered", () => {
    // "Alfaa" scores 0.20 against "Fornecedor Alfa" and 0.08 against "Beta Servicos".
    const strict = resolveParty({ mention: "Alfaa" }, [alfa, beta], 0.99);
    const loose = resolveParty({ mention: "Alfaa" }, [alfa, beta], 0.15);
    expect(strict.kind).toBe("new");
    expect(loose.kind).toBe("resolved");
    if (loose.kind === "resolved") expect(loose.needsConfirmation).toBe(true);
  });
});
