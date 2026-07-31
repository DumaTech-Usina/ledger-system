import { Router, type Request, type Response, type NextFunction } from "express";
import type { GetTreasuryDashboardUseCase } from "../../../../core/application/use-cases/GetTreasuryDashboard";

/** Authorization-filtered display of Ledger truth. Read-only; degrades gracefully if Ledger is down. */
export function dashboardRoutes(getDashboard: GetTreasuryDashboardUseCase): Router {
  const router = Router();

  router.get("/overview", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await getDashboard.execute());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
