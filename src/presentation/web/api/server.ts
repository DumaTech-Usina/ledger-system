import express from "express";
import * as path from "path";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { StagingRepository } from "../../../core/application/repositories/StagingRepository";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { stagingRoutes } from "./routes/stagingRoutes";
import { eventRoutes } from "./routes/eventRoutes";
import { rejectedRoutes } from "./routes/rejectedRoutes";
import { positionRoutes } from "./routes/positionRoutes";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { DashboardService } from "../../../core/application/services/DashboardService";

interface ServerDeps {
  ledgerRepo: LedgerEventRepository;
  rejectedRepo: RejectedEventRepository;
  stagingRepo: StagingRepository;
  positionService: PositionProjectionService;
}

export function createServer(deps: ServerDeps) {
  const app = express();

  app.use(express.static(path.join(__dirname, "..", "client")));

  const dashboardService = new DashboardService(deps.ledgerRepo, deps.positionService);

  app.use("/api/dashboard",        dashboardRoutes(dashboardService));
  app.use("/api/staging",          stagingRoutes(deps.stagingRepo));
  app.use("/api/events/rejected",  rejectedRoutes(deps.rejectedRepo));
  app.use("/api/events",           eventRoutes(deps.ledgerRepo));
  app.use("/api/positions",        positionRoutes(deps.positionService));

  return app;
}
