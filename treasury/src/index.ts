import { readFileSync } from "fs";
import { env } from "./config/env";
import { createServer } from "./presentation/web/api/server";
import { InMemoryIntentRepository } from "./infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "./infra/persistence/InMemoryPartyRepository";
import { SqlitePartyRepository } from "./infra/persistence/SqlitePartyRepository";
import { PartyDirectory } from "./core/application/services/PartyDirectory";
import { InMemoryUserRepository } from "./infra/persistence/InMemoryUserRepository";
import { InMemoryAuditLog } from "./infra/audit/InMemoryAuditLog";
import { InMemoryConversationLog } from "./infra/audit/InMemoryConversationLog";
import { SqliteAuditLog } from "./infra/audit/SqliteAuditLog";
import { SqliteConversationLog } from "./infra/audit/SqliteConversationLog";
import { SqliteIntentRepository } from "./infra/persistence/SqliteIntentRepository";
import { resolveStore } from "./config/operationsStore";
import { InMemoryIdentityLinkRepository } from "./infra/persistence/InMemoryIdentityLinkRepository";
import { SqliteIdentityLinkRepository } from "./infra/persistence/SqliteIdentityLinkRepository";
import { RegisterPartyUseCase } from "./core/application/use-cases/RegisterParty";
import { LinkIdentityUseCase } from "./core/application/use-cases/LinkIdentity";
import { ListPendingIdentitiesUseCase } from "./core/application/use-cases/ListPendingIdentities";
import { GetPartyEventsUseCase } from "./core/application/use-cases/GetPartyEvents";
import type { PartyEventsPort } from "./core/application/ports/PartyEventsPort";
import { Permission } from "./core/domain/enums/Permission";
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
import { GetLedgerEventUseCase } from "./core/application/use-cases/GetLedgerEvent";
import { GetBookExposureUseCase } from "./core/application/use-cases/GetBookExposure";
import { ListPositionsUseCase } from "./core/application/use-cases/ListPositions";
import { ListCashMovementsUseCase } from "./core/application/use-cases/ListCashMovements";
import { ListPayablePositionsUseCase } from "./core/application/use-cases/ListPayablePositions";
import { StartIntentUseCase } from "./core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "./core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "./core/application/use-cases/ApplyAnswers";
import { InterpretUtteranceUseCase } from "./core/application/use-cases/InterpretUtterance";
import { PreviewIntentUseCase } from "./core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "./core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "./core/application/use-cases/SubmitRectification";
import { DecideIdentityUseCase } from "./core/application/use-cases/DecideIdentity";
import { ListSettlementCandidatesUseCase } from "./core/application/use-cases/ListSettlementCandidates";
import { ListPositionActionsUseCase } from "./core/application/use-cases/ListPositionActions";
import { StartPositionActionUseCase } from "./core/application/use-cases/StartPositionAction";
import { LedgerAlgebra, type LedgerAlgebraSnapshot } from "./core/application/services/LedgerAlgebra";
import { GetIntentUseCase } from "./core/application/use-cases/GetIntent";
import { ListIntentsUseCase } from "./core/application/use-cases/ListIntents";
import { RegisterExternalSignalUseCase } from "./core/application/use-cases/RegisterExternalSignal";
import { ListExternalSignalsUseCase } from "./core/application/use-cases/ListExternalSignals";
import { GetPolicySituationUseCase } from "./core/application/use-cases/GetPolicySituation";
import { RegisterInsurerCreditUseCase } from "./core/application/use-cases/RegisterInsurerCredit";
import { ListInsurerReceivablesUseCase } from "./core/application/use-cases/ListInsurerReceivables";
import { PreviewNotices } from "./core/application/services/PreviewNotices";
import { positionsOnly } from "./core/application/services/PositionsOnly";
import { InMemoryExternalSignalRepository } from "./infra/persistence/InMemoryExternalSignalRepository";
import { SqliteExternalSignalRepository } from "./infra/persistence/SqliteExternalSignalRepository";

async function bootstrap(): Promise<void> {
  // ── Composition root ─────────────────────────────────────────────────────────
  // Intents, the audit and the conversation's steps. Durable whenever the Ledger is real, so that the
  // audit (REQ-801) and the link back to each fact (REQ-501) outlive a restart.
  const durableOperations =
    resolveStore(env.LEDGER_MODE, "OPERATIONS_STORE_MODE", env.OPERATIONS_STORE_MODE) === "sqlite";
  const intentRepo = durableOperations
    ? new SqliteIntentRepository(env.OPERATIONS_DB_FILE)
    : new InMemoryIntentRepository();
  // What the insurance system said (§4.6): kept with the operations, since its proposals are intents.
  const signalRepo = durableOperations
    ? new SqliteExternalSignalRepository(env.OPERATIONS_DB_FILE)
    : new InMemoryExternalSignalRepository();
  const audit = durableOperations ? new SqliteAuditLog(env.OPERATIONS_DB_FILE) : new InMemoryAuditLog();
  const conversationLog = durableOperations
    ? new SqliteConversationLog(env.OPERATIONS_DB_FILE)
    : new InMemoryConversationLog();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const candidateMapper = new CandidateMapper(env.USINA_PARTY_ID);

  // ── Party Directory ──────────────────────────────────────────────────────────
  // A PARTY answer is only recorded once it resolves here, so this is on the critical path of every
  // conversation. In "memory" it is empty at boot and every mention falls through unresolved —
  // usable for a disconnected demo, never for issuing ids that reach a Ledger.
  const durableParties =
    resolveStore(env.LEDGER_MODE, "PARTY_DIRECTORY_MODE", env.PARTY_DIRECTORY_MODE) === "sqlite";
  const partyRepo = durableParties ? new SqlitePartyRepository(env.PARTY_DB_FILE) : new InMemoryPartyRepository();
  const identityLinks = durableParties
    ? new SqliteIdentityLinkRepository(env.PARTY_DB_FILE)
    : new InMemoryIdentityLinkRepository();
  const partyDirectory = new PartyDirectory(partyRepo, undefined, identityLinks);

  // An empty Directory is not a broken one — it resolves nothing, honestly. But it also means every
  // counterparty mention falls through, so no scenario with a PARTY slot can be completed by simply
  // answering. That is a deliberate consequence of the barrier and a silent one, so it is announced.
  const knownParties = (await partyDirectory.list()).length;
  if (knownParties === 0) {
    console.warn(
      "[party-directory] EMPTY (" + (durableParties ? "sqlite" : "memory") + "). No counterparty will " +
        "resolve, so every party starts as a provisional identity until it is registered.\n" +
        "  Seed it with: PARTY_DIRECTORY_MODE=sqlite npm run seed:directory",
    );
  } else {
    console.log("[party-directory] " + knownParties + " known part" + (knownParties === 1 ? "y" : "ies") +
      " (" + (durableParties ? "sqlite" : "memory") + ")");
  }

  const applyAnswers = new ApplyAnswersUseCase(intentRepo, clock, conversationLog, partyDirectory);

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
  const curators = new Set(env.CURATOR_USERNAMES.split(",").map((name) => name.trim()));
  const grantsFor = (username: string) => (curators.has(username) ? [Permission.PARTY_CURATE] : []);
  const users = new InMemoryUserRepository(
    seedUsers(hasher, [
      {
        id: "user-cfo",
        username: "cfo",
        displayName: "CFO",
        role: Role.FINANCE_MANAGER,
        password: env.AUTH_MANAGER_PASSWORD,
        grants: grantsFor("cfo"),
      },
      {
        id: "user-viewer",
        username: "viewer",
        displayName: "Analista",
        role: Role.VIEWER,
        password: env.AUTH_VIEWER_PASSWORD,
        grants: grantsFor("viewer"),
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
    PartyEventsPort;
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
  // DEC-035: the listings ask only for kinds that hold a balance; a policy is not something open.
  const positionalTypes = ledgerAlgebra.positionalObjectTypes();
  const positionsRead = positionsOnly(ledgerRead, positionalTypes);
  const getDashboard = new GetTreasuryDashboardUseCase(
    positionsRead,
    env.USINA_PARTY_ID,
    partyDirectory,
  );
  const getObjectLifecycle = new GetObjectLifecycleUseCase(ledgerRead, partyDirectory);
  const getLedgerEvent = new GetLedgerEventUseCase(ledgerRead);
  const getBookExposure = new GetBookExposureUseCase(ledgerRead);
  const listPositions = new ListPositionsUseCase(
    positionsRead,
    env.USINA_PARTY_ID,
    partyDirectory,
  );
  const listPayablePositions = new ListPayablePositionsUseCase(ledgerRead);
  const listCashMovements = new ListCashMovementsUseCase(ledgerRead);

  const startIntent = new StartIntentUseCase(intentRepo, clock, ids, conversationLog);
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
    getLedgerEvent,
    getBookExposure,
    listPositions,
    listPayablePositions,
    listCashMovements,
    startIntent,
    advanceDialog: new AdvanceDialogUseCase(intentRepo, clock, conversationLog, partyDirectory),
    applyAnswers,
    interpretUtterance: new InterpretUtteranceUseCase(
      intentRepo,
      extractor,
      applyAnswers,
      conversationLog,
      clock,
      ids,
      partyDirectory,
    ),
    previewIntent: new PreviewIntentUseCase(intentRepo, candidateMapper, partyDirectory, new PreviewNotices(ledgerRead, positionsRead)),
    submitIntent,
    submitRectification: new SubmitRectificationUseCase(
      ledgerRead,
      startIntent,
      applyAnswers,
      submitIntent,
      clock,
      env.USINA_PARTY_ID,
    ),
    decideIdentity: new DecideIdentityUseCase(intentRepo, partyRepo, clock, ids, conversationLog),
    partyDirectory,
    registerParty: new RegisterPartyUseCase(partyRepo, clock, ids),
    linkIdentity: new LinkIdentityUseCase(partyRepo, identityLinks, clock, ids),
    listPendingIdentities: new ListPendingIdentitiesUseCase(partyRepo, identityLinks, intentRepo),
    getPartyEvents: new GetPartyEventsUseCase(ledgerRead, partyDirectory),
    listSettlementCandidates: new ListSettlementCandidatesUseCase(intentRepo, ledgerRead, partyDirectory),
    // The algebra is a build artifact of the Ledger, read once at boot. A snapshot this build
    // cannot read is refused loudly here rather than producing a silently empty offer.
    listPositionActions: new ListPositionActionsUseCase(ledgerRead, ledgerAlgebra),
    startPositionAction: new StartPositionActionUseCase(
      ledgerRead,
      ledgerRead,
      startIntent,
      applyAnswers,
      env.USINA_PARTY_ID,
    ),
    getIntent: new GetIntentUseCase(intentRepo, audit, conversationLog),
    listIntents: new ListIntentsUseCase(intentRepo),
    registerExternalSignal: new RegisterExternalSignalUseCase(signalRepo, intentRepo, startIntent, applyAnswers, partyDirectory, partyRepo, clock, ids),
    listExternalSignals: new ListExternalSignalsUseCase(signalRepo, intentRepo),
    getPolicySituation: new GetPolicySituationUseCase(ledgerRead, signalRepo, env.USINA_PARTY_ID, partyDirectory),
    registerInsurerCredit: new RegisterInsurerCreditUseCase(
      ledgerRead,
      new StartPositionActionUseCase(ledgerRead, ledgerRead, startIntent, applyAnswers, env.USINA_PARTY_ID),
      startIntent,
      applyAnswers,
      submitIntent,
      clock,
      ids,
    ),
    listInsurerReceivables: new ListInsurerReceivablesUseCase(ledgerRead),
  });

  const server = app.listen(env.PORT, () => {
    console.log(`Treasury User App running on port ${env.PORT}`);
    console.log(`Environment: ${env.LEDGER_MODE}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received — shutting down`);
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
