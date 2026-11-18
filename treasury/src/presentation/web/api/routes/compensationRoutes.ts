import { Router, type Request, type Response, type NextFunction } from "express";
import type { CompensationUseCase } from "../../../../core/application/use-cases/Compensation";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";

/**
 * A compensation of one pair, chosen on the party's page (§8.11, REQ-693). It writes to the Ledger, so
 * it needs submit, like every other write.
 */
export function compensationRoutes(compensation: CompensationUseCase): Router {
  const router = Router();

  router.post("/", requirePermission(Permission.INTENT_SUBMIT), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      res.json(
        await compensation.execute({
          partyId: String(body.partyId ?? ""),
          receivableId: String(body.receivableId ?? ""),
          payableId: String(body.payableId ?? ""),
          amount: String(body.amount ?? ""),
          occurredAt: String(body.occurredAt ?? ""),
          ...(typeof body.description === "string" ? { description: body.description } : {}),
          by: currentUser(req).id,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
