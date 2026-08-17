import { Router, Request, Response, NextFunction } from "express";
import { PositionProjectionService } from "../../../../core/application/services/PositionProjectionService";
import { PositionAggregateOptions, PositionSortKey } from "../../../../core/application/dtos/PositionAggregate";
import { EconomicOutcome, PositionStatus } from "../../../../core/application/dtos/PositionSummary";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { serializePositionListItem, serializePositionSummary } from "../serializers/positionSerializer";
import { parseInstant } from "../../../../core/application/utils/instant";

const VALID_STATUSES  = new Set<string>(["open", "partially_settled", "fully_settled", "reversed", "unknown_origin"]);
const VALID_OUTCOMES  = new Set<string>(["gain", "partial_loss", "full_loss", "cancelled", "pending"]);
const VALID_OBJ_TYPES = new Set<string>(Object.values(ObjectType));
// Closed sets: the repository interpolates the sort key into SQL, so an unrecognised value must fall
// back to the default here rather than travelling any further.
const VALID_SORT_KEYS = new Set<string>(["createdAt", "dueAt"]);
const VALID_SORT_ORDERS = new Set<string>(["ASC", "DESC"]);

/**
 * Reads a filter that admits several values: `?objectType=a&objectType=b` or `?objectType=a,b`.
 *
 * Values outside the closed set are dropped, exactly as a single unrecognised value was dropped
 * before — the route never passes anything to the repository that is not on its list. A selection
 * that ends up empty becomes "no filter", which is what an unrecognised value has always meant
 * here; refusing it would change the behaviour of requests that already work.
 */
function parseSelection<T extends string>(raw: unknown, valid: Set<string>): T[] | undefined {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === "string")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => valid.has(v));
  const unique = [...new Set(parts)] as T[];
  return unique.length > 0 ? unique : undefined;
}

/**
 * A selection with no closed set to check against — party ids are whoever the book recorded.
 *
 * Nothing is validated because there is nothing to validate against: an id the book never saw is
 * not an invalid request, it is a request that matches nothing. The values are bound as parameters,
 * never spliced into SQL.
 */
function parseIds(raw: unknown): string[] | undefined {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === "string")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v !== "");
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique : undefined;
}

/** A date bound from the query string. Invalid input is refused, never silently ignored. */
function parseBound(raw: unknown, label: string): Date | undefined {
  if (typeof raw !== "string" || raw === "") return undefined;
  const date = parseInstant(raw);
  if (isNaN(date.getTime())) {
    throw Object.assign(new Error(`Invalid date in '${label}' parameter`), { statusCode: 400 });
  }
  return date;
}

export function positionRoutes(svc: PositionProjectionService): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawOutcome    = req.query.outcome     as string | undefined;
      const rawSortBy     = req.query.sortBy      as string | undefined;
      const rawSortOrder  = req.query.sortOrder   as string | undefined;

      const from = parseBound(req.query.from, "from");
      const to   = parseBound(req.query.to,   "to");
      if (from && to && from > to) {
        throw Object.assign(new Error("'from' must be before 'to'"), { statusCode: 400 });
      }

      const options: PositionAggregateOptions = {
        page:  parseInt(req.query.page  as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
        // Several values allowed, read as OR. One value behaves exactly as it did before.
        status:     parseSelection<PositionStatus>(req.query.status, VALID_STATUSES),
        outcome:    rawOutcome    && VALID_OUTCOMES.has(rawOutcome)     ? rawOutcome as EconomicOutcome : undefined,
        objectType: parseSelection<ObjectType>(req.query.objectType, VALID_OBJ_TYPES),
        // Positions a party is involved in. Named for what it filters — the ledger does not know
        // which of a position's parties is the reader's own side, so it cannot call one "the
        // counterparty" without asserting something it was never told.
        partyId: parseIds(req.query.partyId),
        from,
        to,
        sortBy:     rawSortBy     && VALID_SORT_KEYS.has(rawSortBy)      ? rawSortBy as PositionSortKey : undefined,
        sortOrder:  rawSortOrder  && VALID_SORT_ORDERS.has(rawSortOrder) ? rawSortOrder as "ASC" | "DESC" : undefined,
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
