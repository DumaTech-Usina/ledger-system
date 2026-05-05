import { Router, Request, Response, NextFunction } from "express";
import { PositionProjectionService } from "../../../../core/application/services/PositionProjectionService";
import { PositionAggregateOptions } from "../../../../core/application/dtos/PositionAggregate";
import { EconomicOutcome, PositionStatus } from "../../../../core/application/dtos/PositionSummary";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { serializePositionListItem, serializePositionSummary } from "../serializers/positionSerializer";

const VALID_STATUSES  = new Set<string>(["open", "partially_settled", "fully_settled", "reversed"]);
const VALID_OUTCOMES  = new Set<string>(["gain", "partial_loss", "full_loss", "cancelled", "pending"]);
const VALID_OBJ_TYPES = new Set<string>(Object.values(ObjectType));

export function positionRoutes(svc: PositionProjectionService): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawStatus     = req.query.status     as string | undefined;
      const rawOutcome    = req.query.outcome     as string | undefined;
      const rawObjectType = req.query.objectType  as string | undefined;

      const options: PositionAggregateOptions = {
        page:  parseInt(req.query.page  as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
        status:     rawStatus     && VALID_STATUSES.has(rawStatus)     ? rawStatus  as PositionStatus  : undefined,
        outcome:    rawOutcome    && VALID_OUTCOMES.has(rawOutcome)     ? rawOutcome as EconomicOutcome : undefined,
        objectType: rawObjectType && VALID_OBJ_TYPES.has(rawObjectType) ? rawObjectType as ObjectType  : undefined,
      };

      const { data, total, page, limit, totalPages } = await svc.summarizePaginated(options);
      res.json({ data: data.map(serializePositionListItem), total, page, limit, totalPages });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:objectId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await svc.summarize(req.params.objectId);
      if (!summary) {
        res.status(404).json({ error: "Position not found" });
        return;
      }
      res.json(serializePositionSummary(summary));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
