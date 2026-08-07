import { readFileSync } from "fs";
import { env } from "./config/env";
import { createServer } from "./presentation/web/api/server";
import { InMemoryIntentRepository } from "./infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "./infra/persistence/InMemoryPartyRepository";
import { MongoPartyRepository, connectMongo } from "./infra/persistence/MongoPartyRepository";
import { PartyDirectory } from "./core/application/services/PartyDirectory";
import { InMemoryUserRepository } from "./infra/persistence/InMemoryUserRepository";
import { InMemoryAuditLog } from "./infra/audit/InMemoryAuditLog";
import { StubCandidateSubmissionAdapter } from "./infra/submission/StubCandidateSubmissionAdapter";
import { HttpCandidateSubmissionAdapter } from "./infra/submission/HttpCandidateSubmissionAdapter";
import { HttpLedgerReadAdapter } from "./infra/ledger-read/HttpLedgerReadAdapter";
import { StubLedgerReadAdapter } from "./infra/ledger-read/StubLedgerReadAdapter";
import { InMemoryLedgerSimulator } from "./infra/ledger-sim/InMemoryLedgerSimulator";
import { StubSlotExtractionAdapter } from "./infra/nlp/StubSlotExtractionAdapter";
import type { CandidateSubmissionPort } from "./core/application/ports/CandidateSubmissionPort";
import type { LedgerReadPort } from "./core/application/ports/LedgerReadPort";
import type { PositionLifecyclePort } from "./core/application/ports/PositionLifecyclePort";
import type { PositionLookupPort } from "./core/application/ports/PositionLookupPort";
import type { LedgerEventLookupPort } from "./core/application/ports/LedgerEventLookupPort";
import type { LedgerEventFeedPort } from "./core/application/ports/LedgerEventFeedPort";
import type { SlotExtractionPort } from "./core/application/ports/SlotExtractionPort";
import { ScryptPasswordHasher } from "./infra/auth/ScryptPasswordHasher";
import { InMemorySessionStore } from "./infra/auth/InMemorySessionStore";
import { seedUsers } from "./infra/auth/seedUsers";
import { SystemClock } from "./infra/system/SystemClock";
import { UuidGenerator } from "./infra/system/UuidGenerator";
import { Role } from "./core/domain/enums/Role";
import { AuthService } from "./core/application/services/AuthService";
import { CandidateMapper } from "./core/application/services/CandidateMapper";
import { GetTreasuryDashboardUseCase } from "./core/application/use-cases/GetTreasuryDashboard";
import { GetObjectLifecycleUseCase } from "./core/application/use-cases/GetObjectLifecycle";
import { GetBookExposureUseCase } from "./core/application/use-cases/GetBookExposure";
import { ListPositionsUseCase } from "./core/application/use-cases/ListPositions";
import { ListPayablePositionsUseCase } from "./core/application/use-cases/ListPayablePositions";
import { StartIntentUseCase } from "./core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "./core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "./core/application/use-cases/ApplyAnswers";
import { InterpretUtteranceUseCase } from "./core/application/use-cases/InterpretUtterance";
import { PreviewIntentUseCase } from "./core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "./core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "./core/application/use-cases/SubmitRectification";
import { DecideIdentityUseCase } from "./core/application/use-cases/DecideIdentity";
import { RecordPartyAttributeUseCase } from "./core/application/use-cases/RecordPartyAttribute";
import { ListIncompletePartiesUseCase } from "./core/application/use-cases/ListIncompleteParties";
import { ListSettlementCandidatesUseCase } from "./core/application/use-cases/ListSettlementCandidates";
import { ListPositionActionsUseCase } from "./core/application/use-cases/ListPositionActions";
import { StartPositionActionUseCase } from "./core/application/use-cases/StartPositionAction";
import { LedgerAlgebra, type LedgerAlgebraSnapshot } from "./core/application/services/LedgerAlgebra";
import { PositionSnapshot } from "./core/application/services/PositionSnapshot";
import { SnapshotRefresher } from "./core/application/services/SnapshotRefresher";
import { GetIntentUseCase } from "./core/application/use-cases/GetIntent";
import { ListIntentsUseCase } from "./core/application/use-cases/ListIntents";

async function bootstrap(): Promise<void> {
  // ── Composition root ─────────────────────────────────────────────────────────
  const intentRepo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const candidateMapper = new CandidateMapper(env.USINA_PARTY_ID);

  // ── Party Directory ──────────────────────────────────────────────────────────
  // A PARTY answer is only recorded once it resolves here, so this is on the critical path of every
  // conversation. In "memory" it is empty at boot and every mention falls through unresolved —
  // usable for a disconnected demo, never for issuing ids that reach a Ledger.
  const partyRepo =
    env.PARTY_DIRECTORY_MODE === "mongo"
      ? new MongoPartyRepository((await connectMongo(env.MONGO_URL, env.MONGO_DB)).db)
      : new InMemoryPartyRepository();
  const partyDirectory = new PartyDirectory(partyRepo);

  // An empty Directory is not a broken one — it resolves nothing, honestly. But it also means every
  // counterparty mention falls through, so no scenario with a PARTY slot can be completed by simply
  // answering. That is a deliberate consequence of the barrier and a silent one, so it is announced.
  const knownParties = (await partyDirectory.list()).length;
  if (knownParties === 0) {
    console.warn(
      "[party-directory] EMPTY (mode: " + env.PARTY_DIRECTORY_MODE + "). No counterparty will resolve, " +
        "so every party slot needs an explicit creation decision.\n" +
        "  Seed it with: PARTY_DIRECTORY_MODE=mongo npm run seed:directory",
    );
  } else {
    console.log("[party-directory] " + knownParties + " known part" + (knownParties === 1 ? "y" : "ies") +
      " (mode: " + env.PARTY_DIRECTORY_MODE + ")");
  }

  const applyAnswers = new ApplyAnswersUseCase(intentRepo, clock, audit, partyDirectory);

  // ── Navigation snapshot ──────────────────────────────────────────────────────
  // A discardable copy of positions the Ledger already answered with, filled lazily and rebuilt by
  // nothing at boot. It exists to make navigating faster and is never the source of an answer: no
  // figure it holds is published, and the import barrier keeps it out of every write path.
  const positionSnapshot = new PositionSnapshot(() => clock.now());

  // ── The Ledger's algebra ─────────────────────────────────────────────────────
  // A build artifact exported from the Ledger's own domain modules, read once. Treasury derives
  // what may touch a position from this instead of keeping a list of its own — the lists it kept
  // before drifted, silently, every time the Ledger widened a matrix.
  const ledgerAlgebra = new LedgerAlgebra(
    JSON.parse(readFileSync(env.LEDGER_ALGEBRA_PATH, "utf8")) as LedgerAlgebraSnapshot,
  );

  // Slot extraction (the LLM boundary), selected by env.EXTRACTION_MODE. Only the deterministic stub
  // exists today; a real-model adapter becomes another case here with no change to core.
  let extractor: SlotExtractionPort;
  switch (env.EXTRACTION_MODE) {
    case "stub":
    default:
      extractor = new StubSlotExtractionAdapter();
  }

  // ── Identity / auth ──────────────────────────────────────────────────────────
  const hasher = new ScryptPasswordHasher();
  const sessionTtlSeconds = env.SESSION_TTL_HOURS * 3600;
  const sessions = new InMemorySessionStore(sessionTtlSeconds * 1000);
  const users = new InMemoryUserRepository(
    seedUsers(hasher, [
      {
        id: "user-cfo",
        username: "cfo",
        displayName: "CFO",
        role: Role.FINANCE_MANAGER,
        password: env.AUTH_MANAGER_PASSWORD,
      },
      {
        id: "user-viewer",
        username: "viewer",
        displayName: "Analista",
        role: Role.VIEWER,
        password: env.AUTH_VIEWER_PASSWORD,
      },
    ]),
  );
  const auth = new AuthService(users, hasher, sessions);

  // ── Ledger integration (mode-selected) ─────────────────────────────────────
  let submission: CandidateSubmissionPort;
  // The same adapter serves both read boundaries in every mode; only the demo ones lack lifecycles.
  let ledgerRead: LedgerReadPort &
    PositionLifecyclePort &
    LedgerEventLookupPort &
    PositionLookupPort &
    Partial<LedgerEventFeedPort>;
  if (env.LEDGER_MODE === "simulate") {
    // One in-memory fake Ledger for BOTH submit + reads → the full create→dashboard loop works.
    const simulator = new InMemoryLedgerSimulator();
    submission = simulator;
    ledgerRead = simulator;
  } else if (env.LEDGER_MODE === "stub") {
    submission = new StubCandidateSubmissionAdapter();
    ledgerRead = new StubLedgerReadAdapter();
  } else {
    // live: real Ledger over HTTP for both submit and reads (both send the service token).
    submission = new HttpCandidateSubmissionAdapter(
      env.LEDGER_API_URL,
      env.LEDGER_SUBMIT_TOKEN,
    );
    ledgerRead = new HttpLedgerReadAdapter(
      env.LEDGER_API_URL,
      env.LEDGER_SUBMIT_TOKEN,
      undefined,
      env.USINA_PARTY_ID,
    );
  }
  const getDashboard = new GetTreasuryDashboardUseCase(
    ledgerRead,
    env.USINA_PARTY_ID,
    partyDirectory,
  );
  const getObjectLifecycle = new GetObjectLifecycleUseCase(ledgerRead);
  const getBookExposure = new GetBookExposureUseCase(ledgerRead);
  const listPositions = new ListPositionsUseCase(ledgerRead, (positions) => positionSnapshot.remember(positions));
  const listPayablePositions = new ListPayablePositionsUseCase(ledgerRead);

  const startIntent = new StartIntentUseCase(intentRepo, clock, ids, audit);
  const submitIntent = new SubmitIntentUseCase(
    intentRepo,
    candidateMapper,
    submission,
    audit,
    clock,
    partyDirectory,
  );

  const app = createServer({
    auth,
    secureCookies: env.NODE_ENV === "production",
    sessionTtlSeconds,
    getDashboard,
    getObjectLifecycle,
    getBookExposure,
    listPositions,
    listPayablePositions,
    startIntent,
    advanceDialog: new AdvanceDialogUseCase(intentRepo, clock, audit, partyDirectory),
    applyAnswers,
    interpretUtterance: new InterpretUtteranceUseCase(
      intentRepo,
      extractor,
      applyAnswers,
      audit,
      clock,
      ids,
      partyDirectory,
    ),
    previewIntent: new PreviewIntentUseCase(intentRepo, candidateMapper, partyDirectory),
    submitIntent,
    submitRectification: new SubmitRectificationUseCase(
      ledgerRead,
      startIntent,
      applyAnswers,
      submitIntent,
      clock,
      env.USINA_PARTY_ID,
    ),
    decideIdentity: new DecideIdentityUseCase(intentRepo, partyRepo, clock, ids, audit),
    recordPartyAttribute: new RecordPartyAttributeUseCase(partyRepo, clock, audit),
    listIncompleteParties: new ListIncompletePartiesUseCase(partyDirectory),
    listSettlementCandidates: new ListSettlementCandidatesUseCase(intentRepo, ledgerRead, partyDirectory),
    // The algebra is a build artifact of the Ledger, read once at boot. A snapshot this build
    // cannot read is refused loudly here rather than producing a silently empty offer.
    listPositionActions: new ListPositionActionsUseCase(ledgerRead, ledgerAlgebra),
    forgetPositions: (objectIds: readonly string[]) => {
      for (const objectId of objectIds) positionSnapshot.invalidate(objectId);
    },
    startPositionAction: new StartPositionActionUseCase(
      ledgerRead,
      ledgerRead,
      startIntent,
      applyAnswers,
      env.USINA_PARTY_ID,
    ),
    getIntent: new GetIntentUseCase(intentRepo, audit),
    listIntents: new ListIntentsUseCase(intentRepo),
  });

  const server = app.listen(env.PORT, () => {
    console.log(`Treasury User App running on port ${env.PORT}`);
    console.log(`Environment: ${env.LEDGER_MODE}`);
  });

  // ── Keeping the snapshot honest ──────────────────────────────────────────────
  // Treasury only knows about its own writes; the staging pipeline and the workers write to the
  // same book. This walks what was RECORDED since the last sweep and forgets the positions those
  // events touched. One request when nothing changed, which is the common case.
  const refresher = ledgerRead.recentlyRecorded
    ? new SnapshotRefresher(ledgerRead as LedgerEventFeedPort, positionSnapshot)
    : null;
  const sweep = async () => {
    if (!refresher) return;
    try {
      const { invalidated, gaveUp } = await refresher.refresh();
      if (gaveUp) console.warn("[snapshot] too far behind to catch up precisely — cleared");
      else if (invalidated.length > 0) console.log(`[snapshot] forgot ${invalidated.length} position(s)`);
    } catch {
      // A Ledger that cannot be reached leaves the snapshot as it is. Stale entries only cost
      // ordering; failing the process over a cache would be the tail wagging the dog.
    }
  };
  void sweep();
  const sweepTimer = setInterval(sweep, env.SNAPSHOT_REFRESH_MINUTES * 60_000);
  sweepTimer.unref();

  const shutdown = (signal: string) => {
    console.log(`${signal} received — shutting down`);
    clearInterval(sweepTimer);
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
