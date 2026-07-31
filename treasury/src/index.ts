import { env } from "./config/env";
import { createServer } from "./presentation/web/api/server";
import { InMemoryIntentRepository } from "./infra/persistence/InMemoryIntentRepository";
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
import { StartIntentUseCase } from "./core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "./core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "./core/application/use-cases/ApplyAnswers";
import { InterpretUtteranceUseCase } from "./core/application/use-cases/InterpretUtterance";
import { PreviewIntentUseCase } from "./core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "./core/application/use-cases/SubmitIntent";
import { GetIntentUseCase } from "./core/application/use-cases/GetIntent";
import { ListIntentsUseCase } from "./core/application/use-cases/ListIntents";

function bootstrap(): void {
  // ── Composition root ─────────────────────────────────────────────────────────
  const intentRepo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const candidateMapper = new CandidateMapper(env.USINA_PARTY_ID);
  const applyAnswers = new ApplyAnswersUseCase(intentRepo, clock, audit);

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
  let ledgerRead: LedgerReadPort & PositionLifecyclePort;
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
    );
  }
  const getDashboard = new GetTreasuryDashboardUseCase(
    ledgerRead,
    env.USINA_PARTY_ID,
  );
  const getObjectLifecycle = new GetObjectLifecycleUseCase(ledgerRead);

  const app = createServer({
    auth,
    secureCookies: env.NODE_ENV === "production",
    sessionTtlSeconds,
    getDashboard,
    getObjectLifecycle,
    startIntent: new StartIntentUseCase(intentRepo, clock, ids, audit),
    advanceDialog: new AdvanceDialogUseCase(intentRepo, clock, audit),
    applyAnswers,
    interpretUtterance: new InterpretUtteranceUseCase(
      intentRepo,
      extractor,
      applyAnswers,
      audit,
      clock,
      ids,
    ),
    previewIntent: new PreviewIntentUseCase(intentRepo, candidateMapper),
    submitIntent: new SubmitIntentUseCase(
      intentRepo,
      candidateMapper,
      submission,
      audit,
      clock,
    ),
    getIntent: new GetIntentUseCase(intentRepo, audit),
    listIntents: new ListIntentsUseCase(intentRepo),
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

bootstrap();
