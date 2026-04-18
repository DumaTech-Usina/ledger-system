import { Router, Request, Response, NextFunction } from "express";
import { RejectedEventRepository } from "../../../../core/application/repositories/RejectedEventRepository";
import { normalizePageOptions } from "../../../../core/application/dtos/Pagination";
import { serializeRejectedEvent } from "../serializers/rejectedSerializer";

export function rejectedRoutes(rejectedRepo: RejectedEventRepository): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
      });
      const { data: events, total, page, limit, totalPages } =
        await rejectedRepo.findPaginated(options);
      res.json({ data: events.map(serializeRejectedEvent), total, page, limit, totalPages });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
