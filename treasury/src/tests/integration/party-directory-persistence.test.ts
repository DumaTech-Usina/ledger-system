import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqlitePartyRepository } from "../../infra/persistence/SqlitePartyRepository";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { LedgerPartySweepSource } from "../../infra/seeding/LedgerPartySweepSource";
import { ImportPartiesUseCase } from "../../core/application/use-cases/ImportParties";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { AttributeSource } from "../../core/domain/enums/AttributeSource";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { PartyAttributeKey } from "../../core/domain/value-objects/PartyAttribute";
import type { Clock } from "../../core/application/ports/Clock";
import { PARTY } from "../fixtures/parties";

const USINA = PARTY.USINA;
const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

let directoryDir: string;
let file: string;

/**
 * Durability is the gate this phase exists for, and it cannot be asserted against a fake.
 *
 * It used to need a MongoDB server and skipped itself when there was none, which meant the one
 * property it was written to prove went unchecked on most runs. The Directory is now a SQLite file,
 * so a restart is what a restart actually is here — a brand new handle opened on the same path,
 * with nothing carried over in process memory — and every case below runs on every commit.
 */
function open(): SqlitePartyRepository {
  return new SqlitePartyRepository(file);
}

describe("Party Directory persistence", () => {
  beforeAll(async () => {
    directoryDir = mkdtempSync(join(tmpdir(), "treasury-directory-"));
    file = join(directoryDir, "treasury.db");

    const repo = open();
    await new ImportPartiesUseCase(repo, clock).execute(
      new LedgerPartySweepSource(new StubLedgerReadAdapter(), USINA),
    );
    // Enrich one party so attributes and provenance have something to survive with.
    await new ImportPartiesUseCase(repo, clock).execute({
      system: "erp",
      fetch: async () => [
        {
          partyId: "ACME Foods",
          displayName: "ACME Alimentos Ltda",
          document: "12.345.678/0001-99",
          type: "client",
          externalIds: [{ system: "erp", value: "C-77" }],
        },
      ],
    });
    repo.close();
  });

  afterAll(() => {
    rmSync(directoryDir, { recursive: true, force: true });
  });

  it("survives a restart with every party intact", async () => {
    const first = open();
    const before = await new PartyDirectory(first).list();
    first.close();

    // A genuinely new handle on the same file — nothing is carried over in process memory.
    const reopened = open();
    const after = await new PartyDirectory(reopened).list();
    reopened.close();

    expect(after.map((p) => p.partyId)).toEqual(before.map((p) => p.partyId));
    expect(after).toHaveLength(5); // four ledger literals + the usina
  });

  it("keeps aliases, attributes and provenance across the restart", async () => {
    const repo = open();
    const acme = await new PartyDirectory(repo).get("ACME Foods");
    repo.close();

    expect(acme?.identityState).toBe(PartyIdentityState.IDENTIFIED);
    expect(acme?.displayName).toBe("ACME Foods");
    expect(acme?.aliases).toEqual(["ACME Alimentos Ltda"]);
    expect(acme?.externalIds).toEqual([{ system: "erp", value: "C-77" }]);
    expect(acme?.attributes[PartyAttributeKey.DOCUMENT]).toMatchObject({
      value: "12.345.678/0001-99",
      source: AttributeSource.IMPORT,
      capturedBy: "erp",
      capturedAt: "2026-08-03T00:00:00.000Z",
    });
    expect(acme?.attributes[PartyAttributeKey.TYPE]?.value).toBe("client");
  });

  it("produces identical cascade results after the restart", async () => {
    const mentions = ["ACME Foods", "acme alimentos", "Grao Verde", "Fornecedor Sol", "Empresa Nova"];

    const first = open();
    const before = await Promise.all(
      mentions.map((m) => new PartyDirectory(first).resolve({ mention: m })),
    );
    first.close();

    const reopened = open();
    const after = await Promise.all(
      mentions.map((m) => new PartyDirectory(reopened).resolve({ mention: m })),
    );
    reopened.close();

    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  it("resolves the imported document — enrichment survived, not just the id", async () => {
    const repo = open();
    const resolution = await new PartyDirectory(repo).resolve({
      mention: "?",
      document: "12345678000199",
    });
    repo.close();

    expect(resolution.kind).toBe("resolved");
    if (resolution.kind === "resolved") expect(resolution.partyId).toBe("ACME Foods");
  });

  it("re-seeding the durable store stays idempotent", async () => {
    const repo = open();
    const result = await new ImportPartiesUseCase(repo, clock).execute(
      new LedgerPartySweepSource(new StubLedgerReadAdapter(), USINA),
    );
    const all = await repo.findAll();
    repo.close();

    expect(result.created).toBe(0);
    expect(all).toHaveLength(5);
  });

  it("stores the PartyId as the primary key — an id can never be duplicated", async () => {
    const repo = open();
    const acme = await repo.findById("ACME Foods");
    await repo.save({ ...acme!, displayName: "Outro Nome" });

    const all = await repo.findAll();
    const renamed = await repo.findById("ACME Foods");
    repo.close();

    expect(all.filter((p) => p.partyId === "ACME Foods")).toHaveLength(1);
    expect(renamed?.displayName).toBe("Outro Nome");

    // Restore, so the ordering of these cases cannot change what a later one reads.
    const restore = open();
    await restore.save({ ...acme! });
    restore.close();
  });
});
