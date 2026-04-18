import express from "express";
import * as path from "path";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { StagingRepository } from "../../../core/application/repositories/StagingRepository";
import { stagingRoutes } from "./routes/stagingRoutes";
import { eventRoutes } from "./routes/eventRoutes";
import { rejectedRoutes } from "./routes/rejectedRoutes";

interface ServerDeps {
  ledgerRepo: LedgerEventRepository;
  rejectedRepo: RejectedEventRepository;
  stagingRepo: StagingRepository;
}

export function createServer(deps: ServerDeps) {
  const app = express();

  app.use(express.static(path.join(__dirname, "..", "client")));

  app.use("/api/staging", stagingRoutes(deps.stagingRepo));
  app.use("/api/events/rejected", rejectedRoutes(deps.rejectedRepo));
  app.use("/api/events", eventRoutes(deps.ledgerRepo));

  return app;
}
