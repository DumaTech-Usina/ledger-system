import express, { type NextFunction, type Request, type Response } from "express";
import * as path from "path";
import { healthRoutes } from "./routes/healthRoutes";
import { conversationRoutes } from "./routes/conversationRoutes";
import { intentRoutes } from "./routes/intentRoutes";
import { authRoutes } from "./routes/authRoutes";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { attachUser, requireAuth, requirePermission } from "./middleware/auth";
import type { PartyDirectoryPort } from "../../../core/application/ports/PartyDirectoryPort";
import type { RegisterPartyUseCase } from "../../../core/application/use-cases/RegisterParty";
import type { LinkIdentityUseCase } from "../../../core/application/use-cases/LinkIdentity";
import type { ListPendingIdentitiesUseCase } from "../../../core/application/use-cases/ListPendingIdentities";
import type { GetPartyEventsUseCase } from "../../../core/application/use-cases/GetPartyEvents";
import { partyRoutes } from "./routes/partyRoutes";
import { signalRoutes } from "./routes/signalRoutes";
import type { RegisterExternalSignalUseCase } from "../../../core/application/use-cases/RegisterExternalSignal";
import type { ListExternalSignalsUseCase } from "../../../core/application/use-cases/ListExternalSignals";
import type { GetPolicySituationUseCase } from "../../../core/application/use-cases/GetPolicySituation";
import type { RegisterInsurerCreditUseCase } from "../../../core/application/use-cases/RegisterInsurerCredit";
import type { ListInsurerReceivablesUseCase } from "../../../core/application/use-cases/ListInsurerReceivables";
import { IntentNotEditableError } from "../../../core/domain/errors/IntentNotEditableError";
import { Permission } from "../../../core/domain/enums/Permission";
import type { AuthService } from "../../../core/application/services/AuthService";
import type { GetTreasuryDashboardUseCase } from "../../../core/application/use-cases/GetTreasuryDashboard";
import type { GetObjectLifecycleUseCase } from "../../../core/application/use-cases/GetObjectLifecycle";
import type { GetBookExposureUseCase } from "../../../core/application/use-cases/GetBookExposure";
import type { ListPositionsUseCase } from "../../../core/application/use-cases/ListPositions";
import type { ListPayablePositionsUseCase } from "../../../core/application/use-cases/ListPayablePositions";
import type { ListCashMovementsUseCase } from "../../../core/application/use-cases/ListCashMovements";
import type { GetLedgerEventUseCase } from "../../../core/application/use-cases/GetLedgerEvent";
import type { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import type { AdvanceDialogUseCase } from "../../../core/application/use-cases/AdvanceDialog";
import type { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import type { InterpretUtteranceUseCase } from "../../../core/application/use-cases/InterpretUtterance";
import type { PreviewIntentUseCase } from "../../../core/application/use-cases/PreviewIntent";
import type { SubmitIntentUseCase } from "../../../core/application/use-cases/SubmitIntent";
import type { SubmitRectificationUseCase } from "../../../core/application/use-cases/SubmitRectification";
import type { DecideIdentityUseCase } from "../../../core/application/use-cases/DecideIdentity";
import type { ListSettlementCandidatesUseCase } from "../../../core/application/use-cases/ListSettlementCandidates";
import type { ListPositionActionsUseCase } from "../../../core/application/use-cases/ListPositionActions";
import type { StartPositionActionUseCase } from "../../../core/application/use-cases/StartPositionAction";
import type { GetIntentUseCase } from "../../../core/application/use-cases/GetIntent";
import type { ListIntentsUseCase } from "../../../core/application/use-cases/ListIntents";

export interface ServerDeps {
  auth: AuthService;
  secureCookies: boolean;
  sessionTtlSeconds: number;
  startIntent: StartIntentUseCase;
  advanceDialog: AdvanceDialogUseCase;
  applyAnswers: ApplyAnswersUseCase;
  interpretUtterance: InterpretUtteranceUseCase;
  previewIntent: PreviewIntentUseCase;
  submitIntent: SubmitIntentUseCase;
  submitRectification: SubmitRectificationUseCase;
  decideIdentity: DecideIdentityUseCase;
  listSettlementCandidates: ListSettlementCandidatesUseCase;
  listPositionActions: ListPositionActionsUseCase;
  startPositionAction: StartPositionActionUseCase;
  partyDirectory: PartyDirectoryPort;
  registerParty: RegisterPartyUseCase;
  linkIdentity: LinkIdentityUseCase;
  listPendingIdentities: ListPendingIdentitiesUseCase;
  getPartyEvents: GetPartyEventsUseCase;
  getIntent: GetIntentUseCase;
  listIntents: ListIntentsUseCase;
  registerExternalSignal: RegisterExternalSignalUseCase;
  listExternalSignals: ListExternalSignalsUseCase;
  getPolicySituation: GetPolicySituationUseCase;
  registerInsurerCredit: RegisterInsurerCreditUseCase;
  listInsurerReceivables: ListInsurerReceivablesUseCase;
  getDashboard: GetTreasuryDashboardUseCase;
  getObjectLifecycle: GetObjectLifecycleUseCase;
  getBookExposure: GetBookExposureUseCase;
  listPositions: ListPositionsUseCase;
  listPayablePositions: ListPayablePositionsUseCase;
  listCashMovements: ListCashMovementsUseCase;
  getLedgerEvent: GetLedgerEventUseCase;
}

export function createServer(deps: ServerDeps) {
  const app = express();
  app.use(express.json());

  app.use(healthRoutes());

  // Resolve the session → user for every request (never blocks; guards do the blocking).
  app.use(attachUser(deps.auth));

  // The conversational operations workspace (static single-page client) + login.
  app.use(express.static(path.join(__dirname, "..", "client")));

  app.use("/api/auth", authRoutes(deps.auth, deps.secureCookies, deps.sessionTtlSeconds));

  app.use(
    "/api/conversation",
    requireAuth,
    requirePermission(Permission.INTENT_CREATE),
    conversationRoutes(
      deps.startIntent,
      deps.advanceDialog,
      deps.applyAnswers,
      deps.interpretUtterance,
      deps.previewIntent,
      deps.submitIntent,
      deps.submitRectification,
      deps.decideIdentity,
      deps.listSettlementCandidates,
      deps.listPositionActions,
      deps.startPositionAction,
    ),
  );
  app.use(
    "/api/parties",
    partyRoutes(deps.partyDirectory, deps.registerParty, deps.linkIdentity, deps.listPendingIdentities, deps.getPartyEvents),
  );
  app.use(
    "/api/intents",
    requireAuth,
    requirePermission(Permission.INTENT_READ),
    intentRoutes(deps.getIntent, deps.listIntents),
  );
  app.use("/api/signals", requireAuth, signalRoutes(
      deps.registerExternalSignal,
      deps.listExternalSignals,
      deps.getPolicySituation,
      deps.registerInsurerCredit,
      deps.listInsurerReceivables,
    ));
  app.use(
    "/api/dashboard",
    requireAuth,
    requirePermission(Permission.DASHBOARD_READ),
    dashboardRoutes(
      deps.getDashboard,
      deps.getObjectLifecycle,
      deps.getBookExposure,
      deps.listPositions,
      deps.listPayablePositions,
      deps.listCashMovements,
      deps.getLedgerEvent,
    ),
  );

  // Minimal error boundary: unknown scenario/intent/slot → 400 with a legible message.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof IntentNotEditableError) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  });

  return app;
}
