import { Router, Request, Response, NextFunction } from "express";
import { CashEventListingService } from "../../../../core/application/services/CashEventListingService";
import { CashMovementSortKey } from "../../../../core/application/dtos/CashStatement";
import { serializeCashMovementPage } from "../serializers/cashMovementSerializer";

const MAX_LIMIT     = 200;
const DEFAULT_LIMIT = 50;
// Closed set: a cash movement is CASH_IN or CASH_OUT and nothing else, so an unrecognised value is
// rejected rather than dropped — silently listing both directions for `effect=cash_ni` would answer
// a question nobody asked.
const VALID_EFFECTS = new Set<string>(["cash_in", "cash_out"]);
// `occurredAt` is when the money moved; `recordedAt` is when the book learned of it. Both are real
// questions, and the answer to one is not the answer to the other.
const VALID_SORT_KEYS = new Set<string>(["occurredAt", "recordedAt"]);
const VALID_SORT_ORDERS = new Set<string>(["ASC", "DESC"]);

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
      // Optional since the listing learned to answer for the whole book. A consumer that always
      // sent it reads exactly what it read before; one that omits it now gets the book instead of
      // a 400, which is a question the route previously refused rather than answered.
      const partyId = req.query.partyId as string | undefined;
      const effect  = req.query.effect  as string | undefined;
      if (effect && !VALID_EFFECTS.has(effect)) {
        res.status(400).json({ error: "effect must be cash_in or cash_out" });
        return;
      }
      // Refused rather than dropped: an unrecognised sort would silently answer in the default
      // order, and a listing that claims one ordering while returning another is worse than an error.
      const sortBy = req.query.sortBy as string | undefined;
      if (sortBy && !VALID_SORT_KEYS.has(sortBy)) {
        res.status(400).json({ error: "sortBy must be occurredAt or recordedAt" });
        return;
      }
      const sortOrder = req.query.sortOrder as string | undefined;
      if (sortOrder && !VALID_SORT_ORDERS.has(sortOrder)) {
        res.status(400).json({ error: "sortOrder must be ASC or DESC" });
        return;
      }
      const rawPage = parseInt(req.query.page as string, 10);
      if (!isNaN(rawPage) && rawPage < 1) {
        res.status(400).json({ error: "page must be 1 or greater" });
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
      const page = await svc.list({
        partyId,
        effect: effect as "cash_in" | "cash_out" | undefined,
        from,
        to,
        limit,
        cursor,
        // Two paging modes, and the caller picks one. Absent means keyset, which costs nothing extra;
        // a page number is what buys the count.
        page: isNaN(rawPage) ? undefined : rawPage,
        sortBy: sortBy as CashMovementSortKey | undefined,
        sortOrder: sortOrder as "ASC" | "DESC" | undefined,
      });
      res.json(serializeCashMovementPage(page));
    } catch (err) {
      next(err);
    }
  });
  return router;
}
