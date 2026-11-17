import { Router, type Request, type Response, type NextFunction } from "express";
import type { InstitutionCashUseCase } from "../../../../core/application/use-cases/InstitutionCash";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";

/**
 * The money in each institution (§8.8). Reading the balances is reading; the opening balance, the
 * transfer and the statement balance change what the book says or what it is checked against, so they
 * need submit — the CFO's job (§18.1).
 */
export function cashRoutes(cash: InstitutionCashUseCase): Router {
  const router = Router();
  const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

  /** The configured institutions, for every screen that asks where the money moved (REQ-674). */
  router.get("/institutions/list", requirePermission(Permission.DASHBOARD_READ), (_req: Request, res: Response) => {
    res.json({ institutions: cash.institutions() });
  });

  /** ?asOf=YYYY-MM-DD (default: today in São Paulo). */
  router.get("/institutions", requirePermission(Permission.DASHBOARD_READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asOf = typeof req.query.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : undefined;
      res.json(await cash.read(asOf));
    } catch (err) {
      next(err);
    }
  });

  router.get("/institutions/:key/statements", requirePermission(Permission.DASHBOARD_READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ statements: await cash.history(req.params.key) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/openings", requirePermission(Permission.INTENT_SUBMIT), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = (req.body ?? {}) as Record<string, unknown>;
      res.status(201).json(
        await cash.registerOpening({
          institution: str(b.institution),
          amount: str(b.amount),
          occurredAt: str(b.occurredAt),
          description: str(b.description),
          by: currentUser(req).id,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.post("/transfers", requirePermission(Permission.INTENT_SUBMIT), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = (req.body ?? {}) as Record<string, unknown>;
      res.status(201).json(
        await cash.registerTransfer({
          from: str(b.from),
          to: str(b.to),
          amount: str(b.amount),
          occurredAt: str(b.occurredAt),
          description: str(b.description),
          by: currentUser(req).id,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.post("/statements", requirePermission(Permission.INTENT_SUBMIT), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = (req.body ?? {}) as Record<string, unknown>;
      res.status(201).json(
        await cash.informStatement({ institution: str(b.institution), day: str(b.day), amount: str(b.amount), by: currentUser(req).id }),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
