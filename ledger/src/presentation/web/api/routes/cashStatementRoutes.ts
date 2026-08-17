import { Router, Request, Response, NextFunction } from "express";
import { CashStatementService } from "../../../../core/application/services/CashStatementService";
import { serializeCashStatement } from "../serializers/cashStatementSerializer";
import { parseInstant } from "../../../../core/application/utils/instant";

export function cashStatementRoutes(svc: CashStatementService): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fromStr = req.query.from as string | undefined;
      const toStr   = req.query.to   as string | undefined;
      if (!fromStr || !toStr) {
        res.status(400).json({ error: "from and to are required" });
        return;
      }
      const from = parseInstant(fromStr);
      const to   = parseInstant(toStr);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        res.status(400).json({ error: "Invalid date format" });
        return;
      }
      res.json(serializeCashStatement(await svc.summarize(from, to)));
    } catch (err) {
      next(err);
    }
  });
  return router;
}
