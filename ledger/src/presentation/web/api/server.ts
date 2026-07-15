import express from "express";
import * as path from "path";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { StagingRepository } from "../../../core/application/repositories/StagingRepository";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { CashStatementService } from "../../../core/application/services/CashStatementService";
import { CashEventListingService } from "../../../core/application/services/CashEventListingService";
import { stagingRoutes } from "./routes/stagingRoutes";
import { eventRoutes } from "./routes/eventRoutes";
import { rejectedRoutes } from "./routes/rejectedRoutes";
import { positionRoutes } from "./routes/positionRoutes";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { cashPositionRoutes } from "./routes/cashPositionRoutes";
import { cashStatementRoutes } from "./routes/cashStatementRoutes";
import { cashMovementsRoutes } from "./routes/cashMovementsRoutes";
import { DashboardService } from "../../../core/application/services/DashboardService";
import { BookHealthService } from "../../../core/application/services/BookHealthService";
import { healthRoutes, ReadinessProbe } from "./routes/healthRoutes";
import { submitRoutes } from "./routes/submitRoutes";
import { requireServiceToken } from "./middleware/serviceAuth";
import { SubmitCandidateUseCase } from "../../../core/application/use-cases/SubmitCandidateUseCase";

interface ServerDeps {
  ledgerRepo: LedgerEventRepository;
  rejectedRepo: RejectedEventRepository;
  stagingRepo: StagingRepository;
  positionService: PositionProjectionService;
  usinaPartyId: string;
  cashPositionService: CashPositionService;
  cashStatementService: CashStatementService;
  cashListingService: CashEventListingService;
  readiness: ReadinessProbe;
  submitCandidate: SubmitCandidateUseCase;
  /** Service token guarding the entire Ledger API (reads + writes). Empty = API fails closed. */
  serviceToken: string;
}

export function createServer(deps: ServerDeps) {
  const app = express();
  app.use(express.json());

  // Liveness/readiness first — unauthenticated probes for the orchestrator/proxy (no data exposed).
  app.use(healthRoutes(deps.readiness));

  // Everything below requires the service token: the Ledger's ENTIRE API surface is protected
  // (reads included), and fails closed if no token is configured.
  app.use(requireServiceToken(deps.serviceToken));

  app.use(express.static(path.join(__dirname, "..", "client")));

  const bookHealthService = new BookHealthService(deps.ledgerRepo);
  const dashboardService = new DashboardService(
    deps.ledgerRepo,
    deps.positionService,
    bookHealthService,
  );
  const cashPositionService = deps.cashPositionService;
  const cashStatementService = deps.cashStatementService;
  const cashListingService = deps.cashListingService;

  app.use("/api/dashboard", dashboardRoutes(dashboardService));
  app.use("/api/staging", stagingRoutes(deps.stagingRepo));
  app.use("/api/events/rejected", rejectedRoutes(deps.rejectedRepo));
  app.use("/api/events", eventRoutes(deps.ledgerRepo));
  app.use("/api/positions", positionRoutes(deps.positionService));
  app.use("/api/cash-position", cashPositionRoutes(cashPositionService));
  app.use("/api/cash-statement", cashStatementRoutes(cashStatementService));
  app.use("/api/cash-movements", cashMovementsRoutes(cashListingService));

  // User App ↔ Ledger submission (protected by the global gate above).
  app.use("/api/intents", submitRoutes(deps.submitCandidate));

  return app;
}
