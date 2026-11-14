import { Router, type Request, type Response, type NextFunction } from "express";
import type { PayablesBatchUseCase } from "../../../../core/application/use-cases/PayablesBatch";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";

/**
 * The day's payments in one batch (§8.6). Seeing the batches is reading; preparing, discarding and
 * recording the payment change what will be — or is — sent to the Ledger, so they need submit.
 */
export function batchRoutes(batches: PayablesBatchUseCase): Router {
  const router = Router();

  router.get("/", requirePermission(Permission.DASHBOARD_READ), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await batches.list());
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requirePermission(Permission.INTENT_SUBMIT), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
      res.status(201).json(
        await batches.prepare({
          items: items.map((i) => ({ objectId: String(i?.objectId ?? ""), amount: String(i?.amount ?? "") })),
          by: currentUser(req).id,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.post("/:batchId/discard", requirePermission(Permission.INTENT_SUBMIT), async (req: Request, res: Response, next: NextFunction) => {
    try {
      await batches.discard(req.params.batchId, currentUser(req).id);
      res.json({ discarded: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:batchId/pay", requirePermission(Permission.INTENT_SUBMIT), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      // The institution is a key or an explicit null ("not stated"); absent is refused, never assumed.
      const institution = "institution" in body ? (body.institution === null ? null : String(body.institution)) : undefined;
      res.json(
        await batches.pay({
          batchId: req.params.batchId,
          occurredAt: String(body.occurredAt ?? ""),
          institution,
          debit: String(body.debit ?? ""),
          by: currentUser(req).id,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
