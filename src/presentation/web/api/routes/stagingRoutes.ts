import { Router, Request, Response, NextFunction } from "express";
import { StagingRepository } from "../../../../core/application/repositories/StagingRepository";
import { normalizePageOptions } from "../../../../core/application/dtos/Pagination";

export function stagingRoutes(stagingRepo: StagingRepository): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
      });
      res.json(await stagingRepo.findPaginated(options));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
