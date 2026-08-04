import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient } from "mongodb";
import { connectMongo, MongoPartyRepository } from "../../infra/persistence/MongoPartyRepository";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { LedgerPartySweepSource } from "../../infra/seeding/LedgerPartySweepSource";
import { ImportPartiesUseCase } from "../../core/application/use-cases/ImportParties";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { AttributeSource } from "../../core/domain/enums/AttributeSource";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { PartyAttributeKey } from "../../core/domain/value-objects/PartyAttribute";
import type { Clock } from "../../core/application/ports/Clock";
import { PARTY } from "../fixtures/parties";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://root:rootpassword@localhost:27017";
const DB_NAME = `treasury_test_${Date.now()}`;
const USINA = PARTY.USINA;
const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

/**
 * Durability is the gate this phase exists for, and it cannot be asserted against a fake. The suite
 * therefore probes for a real MongoDB and skips when there is none, rather than passing on a mock
 * that would prove nothing about surviving a restart.
 */
async function mongoAvailable(): Promise<boolean> {
  const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 1500 });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => undefined);
  }
}

describe("Party Directory persistence", () => {
  let available = false;
  let seeded: { db: Awaited<ReturnType<typeof connectMongo>>["db"]; close: () => Promise<void> };

  beforeAll(async () => {
    available = await mongoAvailable();
    if (!available) return;

    seeded = await connectMongo(MONGO_URL, DB_NAME);
    const repo = new MongoPartyRepository(seeded.db);
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
  });

  afterAll(async () => {
    if (!available) return;
    await seeded.db.dropDatabase();
    await seeded.close();
  });

  it("survives a restart with every party intact", async (ctx) => {
    if (!available) ctx.skip();
    const before = await new PartyDirectory(new MongoPartyRepository(seeded.db)).list();
    await seeded.close();

    // A genuinely new client — nothing is carried over in process memory.
    const reopened = await connectMongo(MONGO_URL, DB_NAME);
    seeded = reopened;
    const after = await new PartyDirectory(new MongoPartyRepository(reopened.db)).list();

    expect(after.map((p) => p.partyId)).toEqual(before.map((p) => p.partyId));
    expect(after).toHaveLength(5); // four ledger literals + the usina
  });

  it("keeps aliases, attributes and provenance across the restart", async (ctx) => {
    if (!available) ctx.skip();
    const directory = new PartyDirectory(new MongoPartyRepository(seeded.db));
    const acme = await directory.get("ACME Foods");

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

  it("produces identical cascade results after the restart", async (ctx) => {
    if (!available) ctx.skip();
    const directory = new PartyDirectory(new MongoPartyRepository(seeded.db));
    const mentions = ["ACME Foods", "acme alimentos", "Grao Verde", "Fornecedor Sol", "Empresa Nova"];

    const first = await Promise.all(mentions.map((m) => directory.resolve({ mention: m })));

    const reopened = await connectMongo(MONGO_URL, DB_NAME);
    const second = await Promise.all(
      mentions.map((m) => new PartyDirectory(new MongoPartyRepository(reopened.db)).resolve({ mention: m })),
    );
    await reopened.close();

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("resolves the imported document — enrichment survived, not just the id", async (ctx) => {
    if (!available) ctx.skip();
    const directory = new PartyDirectory(new MongoPartyRepository(seeded.db));
    const resolution = await directory.resolve({ mention: "?", document: "12345678000199" });
    expect(resolution.kind).toBe("resolved");
    if (resolution.kind === "resolved") expect(resolution.partyId).toBe("ACME Foods");
  });

  it("re-seeding the durable store stays idempotent", async (ctx) => {
    if (!available) ctx.skip();
    const repo = new MongoPartyRepository(seeded.db);
    const result = await new ImportPartiesUseCase(repo, clock).execute(
      new LedgerPartySweepSource(new StubLedgerReadAdapter(), USINA),
    );

    expect(result.created).toBe(0);
    expect(await repo.findAll()).toHaveLength(5);
  });

  it("stores the PartyId as the primary key — an id can never be duplicated", async (ctx) => {
    if (!available) ctx.skip();
    const repo = new MongoPartyRepository(seeded.db);
    const acme = await repo.findById("ACME Foods");
    await repo.save({ ...acme!, displayName: "Outro Nome" });

    const all = await repo.findAll();
    expect(all.filter((p) => p.partyId === "ACME Foods")).toHaveLength(1);
    expect((await repo.findById("ACME Foods"))?.displayName).toBe("Outro Nome");
  });
});

