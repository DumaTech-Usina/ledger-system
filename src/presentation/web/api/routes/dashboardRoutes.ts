import { Router, Request, Response, NextFunction } from "express";
import { DashboardService } from "../../../../core/application/services/DashboardService";
import { serializeDashboard } from "../serializers/dashboardSerializer";

const DEFAULT_PERIOD_DAYS = 30;

function parsePeriod(req: Request): { from: Date; to: Date } {
  const now = new Date();
  const to   = req.query.to   ? new Date(req.query.to   as string) : now;
  const from = req.query.from ? new Date(req.query.from as string) : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw Object.assign(new Error("Invalid date in 'from' or 'to' parameter"), { statusCode: 400 });
  }
  if (from > to) {
    throw Object.assign(new Error("'from' must be before 'to'"), { statusCode: 400 });
  }

  return { from, to };
}

export function dashboardRoutes(svc: DashboardService): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = parsePeriod(req);
      const summary = await svc.compute(from, to);
      res.json(serializeDashboard(summary));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
