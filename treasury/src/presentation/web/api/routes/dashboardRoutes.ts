import { Router, type Request, type Response, type NextFunction } from "express";
import type { GetTreasuryDashboardUseCase } from "../../../../core/application/use-cases/GetTreasuryDashboard";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the query param when it's a plain "yyyy-mm-dd" string, otherwise undefined. */
function parseIsoDate(value: unknown): string | undefined {
  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
}

/** Authorization-filtered display of Ledger truth. Read-only; degrades gracefully if Ledger is down. */
export function dashboardRoutes(getDashboard: GetTreasuryDashboardUseCase): Router {
  const router = Router();

  router.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = parseIsoDate(req.query.from);
      const to = parseIsoDate(req.query.to);
      res.json(await getDashboard.execute({ from, to }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
