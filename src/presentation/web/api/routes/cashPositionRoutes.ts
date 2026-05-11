import { Router, Request, Response, NextFunction } from "express";
import { CashPositionService } from "../../../../core/application/services/CashPositionService";
import { serializeCashPosition } from "../serializers/cashPositionSerializer";

export function cashPositionRoutes(svc: CashPositionService): Router {
  const router = Router();
  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(serializeCashPosition(await svc.summarize()));
    } catch (err) {
      next(err);
    }
  });
  return router;
}
