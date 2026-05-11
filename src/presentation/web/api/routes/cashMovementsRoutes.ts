import { Router, Request, Response, NextFunction } from "express";
import { CashEventListingService } from "../../../../core/application/services/CashEventListingService";
import { serializeCashMovementPage } from "../serializers/cashMovementSerializer";

const MAX_LIMIT     = 200;
const DEFAULT_LIMIT = 50;

export function cashMovementsRoutes(svc: CashEventListingService): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit    = isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit;
      if (limit > MAX_LIMIT) {
        res.status(400).json({ error: `limit cannot exceed ${MAX_LIMIT}` });
        return;
      }
      const partyId = req.query.partyId as string | undefined;
      if (!partyId) {
        res.status(400).json({ error: "partyId is required" });
        return;
      }
      const fromStr = req.query.from   as string | undefined;
      const toStr   = req.query.to     as string | undefined;
      const cursor  = req.query.cursor as string | undefined;
      const from    = fromStr ? new Date(fromStr) : undefined;
      const to      = toStr   ? new Date(toStr)   : undefined;
      if (from && isNaN(from.getTime())) {
        res.status(400).json({ error: "Invalid from date" });
        return;
      }
      if (to && isNaN(to.getTime())) {
        res.status(400).json({ error: "Invalid to date" });
        return;
      }
      const page = await svc.list({ partyId, from, to, limit, cursor });
      res.json(serializeCashMovementPage(page));
    } catch (err) {
      next(err);
    }
  });
  return router;
}
