import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { partyRoutes } from "../../presentation/web/api/routes/partyRoutes";
import { ListPartiesUseCase } from "../../core/application/use-cases/ListParties";
import { RenamePartyUseCase } from "../../core/application/use-cases/RenameParty";
import { Role } from "../../core/domain/enums/Role";
import { PARTY, seededDirectory } from "../fixtures/parties";

/**
 * Exercises the HTTP surface `partyRoutes` is actually reached through: permission gating (list is
 * readable by any authenticated role with dashboard access; rename is not) and the 422 mapping for
 * a rejected rename. The use cases have their own unit tests; what's verified here is the wiring.
 */
function harness(role: Role) {
  const { directory, repo: parties } = seededDirectory();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user: unknown }).user = {
      id: "user-1",
      username: "u",
      displayName: "U",
      role,
    };
    next();
  });
  app.use(
    "/api/parties",
    partyRoutes(
      new ListPartiesUseCase(directory, PARTY.USINA),
      new RenamePartyUseCase(parties),
    ),
  );
  return { app, directory, parties };
}

let server: Server;
let base: string;

async function listen(app: express.Express) {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("GET /api/parties", () => {
  it("lists every seeded counterparty except the usina, for a viewer", async () => {
    await listen(harness(Role.VIEWER).app);
    const res = await fetch(`${base}/api/parties`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { parties: { partyId: string }[] };
    const ids = body.parties.map((p) => p.partyId);
    expect(ids).not.toContain(PARTY.USINA);
    expect(ids).toContain(PARTY.ACME);
  });

  it("is also reachable by a finance manager", async () => {
    await listen(harness(Role.FINANCE_MANAGER).app);
    const res = await fetch(`${base}/api/parties`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/parties/:partyId/rename", () => {
  it("refuses a viewer with 403", async () => {
    await listen(harness(Role.VIEWER).app);
    const res = await fetch(`${base}/api/parties/${PARTY.ACME}/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "ACME Nova" }),
    });
    expect(res.status).toBe(403);
  });

  it("renames the party for a finance manager and the list reflects it", async () => {
    const { app, parties } = harness(Role.FINANCE_MANAGER);
    await listen(app);
    const res = await fetch(`${base}/api/parties/${PARTY.ACME}/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "ACME Nova Razão Social" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ partyId: PARTY.ACME, displayName: "ACME Nova Razão Social" });
    expect((await parties.findById(PARTY.ACME))?.displayName).toBe("ACME Nova Razão Social");
  });

  it("answers 422 (not a fault) for an unknown party", async () => {
    await listen(harness(Role.FINANCE_MANAGER).app);
    const res = await fetch(`${base}/api/parties/party-does-not-exist/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "X" }),
    });
    expect(res.status).toBe(422);
  });

  it("answers 400 when displayName is missing", async () => {
    await listen(harness(Role.FINANCE_MANAGER).app);
    const res = await fetch(`${base}/api/parties/${PARTY.ACME}/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
