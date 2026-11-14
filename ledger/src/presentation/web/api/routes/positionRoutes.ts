import { Router, Request, Response, NextFunction } from "express";
import { PositionProjectionService } from "../../../../core/application/services/PositionProjectionService";
import { PositionAggregateOptions, PositionSortKey } from "../../../../core/application/dtos/PositionAggregate";
import { EconomicOutcome, PositionStatus } from "../../../../core/application/dtos/PositionSummary";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { serializePositionListItem, serializePositionSummary } from "../serializers/positionSerializer";
import { parseInstant } from "../../../../core/application/utils/instant";
import {
  AGENDA_WINDOWS,
  isAgendaDay,
  type AgendaWindow,
  type PayablesAgenda,
  type PayablesAgendaService,
} from "../../../../core/application/services/PayablesAgendaService";
import {
  RECEIVABLES_AGENDA_LISTS,
  type ReceivablesAgenda,
  type ReceivablesAgendaList,
  type ReceivablesAgendaService,
} from "../../../../core/application/services/ReceivablesAgendaService";

const VALID_STATUSES  = new Set<string>(["open", "partially_settled", "fully_settled", "reversed", "unknown_origin"]);
const VALID_OUTCOMES  = new Set<string>(["gain", "compensated", "partial_loss", "full_loss", "cancelled", "pending"]);
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

const MAX_WINDOW_DAYS = 365;

/** Integer query parameter within [min, max], or 400. Absent is undefined. */
function intParam(raw: unknown, label: string, min: number, max: number): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw Object.assign(new Error(`'${label}' must be an integer between ${min} and ${max}`), { statusCode: 400 });
  }
  return value;
}

function serializeSummary(s: { count: number; totals: Record<string, { toString(): string }> }) {
  return { count: s.count, totals: Object.fromEntries(Object.entries(s.totals).map(([c, m]) => [c, m.toString()])) };
}

function serializeReceivablesAgenda(agenda: ReceivablesAgenda) {
  return {
    asOf: agenda.asOf,
    windowDays: agenda.windowDays,
    windows: Object.fromEntries(Object.entries(agenda.windows).map(([w, s]) => [w, serializeSummary(s)])),
    unlinked: serializeSummary(agenda.unlinked),
    payers: agenda.payers.map((p) => ({ key: p.key, partyIds: p.partyIds, ...serializeSummary(p) })),
    payer: agenda.payer,
    window: agenda.window,
    data: agenda.data.map(serializePositionListItem),
    total: agenda.total,
    page: agenda.page,
    limit: agenda.limit,
    totalPages: agenda.totalPages,
  };
}

function serializeAgenda(agenda: PayablesAgenda) {
  return {
    asOf: agenda.asOf,
    windowDays: agenda.windowDays,
    windows: Object.fromEntries(Object.entries(agenda.windows).map(([w, s]) => [w, serializeSummary(s)])),
    window: agenda.window,
    data: agenda.data.map(serializePositionListItem),
    total: agenda.total,
    page: agenda.page,
    limit: agenda.limit,
    totalPages: agenda.totalPages,
  };
}

export function positionRoutes(
  svc: PositionProjectionService,
  agenda?: PayablesAgendaService,
  receivables?: ReceivablesAgendaService,
): Router {
  const router = Router();

  /**
   * GET /api/positions/agenda/payables — what the Usina owes and is still open, by due window, with
   * the total of each window (treasury/docs/requisitos_refinados.md §8.5). A reading; it changes nothing.
   *   ?asOf=YYYY-MM-DD (default: today in the Usina's zone) &windowDays=7 &window=overdue|today|next|later|undated
   *   &page=1 &limit=20 (max 200)
   * Declared before `/:objectId`, which would otherwise read "agenda" as a position id.
   */
  if (agenda) {
    router.get("/agenda/payables", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const asOf = req.query.asOf as string | undefined;
        if (asOf !== undefined && !isAgendaDay(asOf)) {
          throw Object.assign(new Error("'asOf' must be a date as YYYY-MM-DD"), { statusCode: 400 });
        }
        const window = req.query.window as string | undefined;
        if (window !== undefined && !(AGENDA_WINDOWS as readonly string[]).includes(window)) {
          throw Object.assign(new Error(`'window' must be one of ${AGENDA_WINDOWS.join(", ")}`), { statusCode: 400 });
        }
        const result = await agenda.read({
          asOf,
          window: window as AgendaWindow | undefined,
          windowDays: intParam(req.query.windowDays, "windowDays", 0, MAX_WINDOW_DAYS),
          page: intParam(req.query.page, "page", 1, Number.MAX_SAFE_INTEGER),
          limit: intParam(req.query.limit, "limit", 1, 200),
        });
        res.json(serializeAgenda(result));
      } catch (err) {
        next(err);
      }
    });
  }

  /**
   * GET /api/positions/agenda/receivables — what is owed to the Usina and still open, by expected date
   * and by payer, and the receipts with no known origin (treasury/docs/requisitos_refinados.md §8.7).
   *   Same parameters as the payables agenda, plus &window=unlinked and &payer=<key> ("" = no payer named).
   */
  if (receivables) {
    router.get("/agenda/receivables", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const asOf = req.query.asOf as string | undefined;
        if (asOf !== undefined && !isAgendaDay(asOf)) {
          throw Object.assign(new Error("'asOf' must be a date as YYYY-MM-DD"), { statusCode: 400 });
        }
        const window = req.query.window as string | undefined;
        if (window !== undefined && !(RECEIVABLES_AGENDA_LISTS as readonly string[]).includes(window)) {
          throw Object.assign(new Error(`'window' must be one of ${RECEIVABLES_AGENDA_LISTS.join(", ")}`), { statusCode: 400 });
        }
        const payer = req.query.payer;
        if (payer !== undefined && typeof payer !== "string") {
          throw Object.assign(new Error("'payer' must be given once"), { statusCode: 400 });
        }
        const result = await receivables.read({
          asOf,
          window: window as ReceivablesAgendaList | undefined,
          payer,
          windowDays: intParam(req.query.windowDays, "windowDays", 0, MAX_WINDOW_DAYS),
          page: intParam(req.query.page, "page", 1, Number.MAX_SAFE_INTEGER),
          limit: intParam(req.query.limit, "limit", 1, 200),
        });
        res.json(serializeReceivablesAgenda(result));
      } catch (err) {
        next(err);
      }
    });
  }

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
