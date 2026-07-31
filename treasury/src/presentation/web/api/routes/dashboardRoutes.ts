import { Router, type Request, type Response, type NextFunction } from "express";
import type { GetTreasuryDashboardUseCase } from "../../../../core/application/use-cases/GetTreasuryDashboard";
import type { GetObjectLifecycleUseCase } from "../../../../core/application/use-cases/GetObjectLifecycle";

/** Authorization-filtered display of Ledger truth. Read-only; degrades gracefully if Ledger is down. */
export function dashboardRoutes(
  getDashboard: GetTreasuryDashboardUseCase,
  getLifecycle: GetObjectLifecycleUseCase,
): Router {
  const router = Router();

  router.get("/overview", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await getDashboard.execute());
    } catch (err) {
      next(err);
    }
  });

  // The life of one economic object: the position and the ordered events that shaped it. 404 means
  // the Ledger knows no such object — not that nothing ever happened to it.
  router.get("/positions/:objectId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lifecycle = await getLifecycle.execute(req.params.objectId);
      if (!lifecycle) {
        res.status(404).json({ error: "Position not found" });
        return;
      }
      res.json(lifecycle);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
