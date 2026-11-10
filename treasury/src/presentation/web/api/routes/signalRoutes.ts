import { Router, type Request, type Response, type NextFunction } from "express";
import type { RegisterExternalSignalUseCase } from "../../../../core/application/use-cases/RegisterExternalSignal";
import type { ListExternalSignalsUseCase } from "../../../../core/application/use-cases/ListExternalSignals";
import type { GetPolicySituationUseCase } from "../../../../core/application/use-cases/GetPolicySituation";
import type { RegisterInsurerCreditUseCase } from "../../../../core/application/use-cases/RegisterInsurerCredit";
import type { ListInsurerReceivablesUseCase } from "../../../../core/application/use-cases/ListInsurerReceivables";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";

/**
 * Signals from the insurance system (§4.6). Registering one only proposes facts, so it needs the
 * permission to start an operation, not to submit one: the submit happens later, per proposal,
 * through the conversation.
 */
export function signalRoutes(
  register: RegisterExternalSignalUseCase,
  list: ListExternalSignalsUseCase,
  policySituation: GetPolicySituationUseCase,
  insurerCredit: RegisterInsurerCreditUseCase,
  insurerReceivables: ListInsurerReceivablesUseCase,
): Router {
  const router = Router();

  /** The expected commissions still open with one insurer: what a credit can be spread over (block D). */
  router.get(
    "/credits/receivables",
    requirePermission(Permission.INTENT_READ),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const payer = typeof req.query.payer === "string" ? req.query.payer : "";
        if (!payer) {
          res.status(400).json({ error: "payer is required." });
          return;
        }
        res.json({ receivables: await insurerReceivables.execute(payer) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** Records a credit from the insurer as a batch of receipts. Sends to the Ledger, so it needs submit. */
  router.post(
    "/credits",
    requirePermission(Permission.INTENT_SUBMIT),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const allocations = Array.isArray(body.allocations) ? (body.allocations as { objectId: string; amount: string }[]) : [];
        res.status(201).json(
          await insurerCredit.execute({
            payer: String(body.payer ?? ""),
            creditAmount: String(body.creditAmount ?? ""),
            occurredAt: String(body.occurredAt ?? ""),
            allocations: allocations.map((a) => ({ objectId: String(a.objectId ?? ""), amount: String(a.amount ?? "") })),
            userId: currentUser(req).id,
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  /** What the Ledger knows about one policy, beside what the insurance system said (block C). */
  router.get(
    "/policies/:policyId",
    requirePermission(Permission.INTENT_READ),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(await policySituation.execute(req.params.policyId));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/", requirePermission(Permission.INTENT_READ), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ signals: await list.execute() });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requirePermission(Permission.INTENT_CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { kind, fields } = (req.body ?? {}) as { kind?: unknown; fields?: unknown };
      const result = await register.execute({
        kind: kind as never,
        fields: fields && typeof fields === "object" ? (fields as Record<string, unknown>) : {},
        userId: currentUser(req).id,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
