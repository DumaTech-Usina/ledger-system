import { Router, type Request, type Response, type NextFunction } from "express";
import type { GetTreasuryDashboardUseCase } from "../../../../core/application/use-cases/GetTreasuryDashboard";
import type { GetObjectLifecycleUseCase } from "../../../../core/application/use-cases/GetObjectLifecycle";
import type { GetBookExposureUseCase } from "../../../../core/application/use-cases/GetBookExposure";
import type { ListPositionsUseCase } from "../../../../core/application/use-cases/ListPositions";
import type { ListPayablePositionsUseCase } from "../../../../core/application/use-cases/ListPayablePositions";
import type { ListCashMovementsUseCase } from "../../../../core/application/use-cases/ListCashMovements";
import type { GetLedgerEventUseCase } from "../../../../core/application/use-cases/GetLedgerEvent";

/** A positive integer from the query string, or undefined. Absent is not zero. */
function intParam(raw: unknown): number | undefined {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** A single string parameter, or undefined when absent or empty. */
function strParam(raw: unknown): string | undefined {
  return typeof raw === "string" && raw !== "" ? raw : undefined;
}

/**
 * A filter that admits several values: `?objectType=a&objectType=b` or `?objectType=a,b`.
 *
 * Nothing is validated here on purpose. The Ledger owns the closed sets, and a second copy of them
 * in treasury would be a rule that exists twice and can disagree — the mistake §7 of
 * `refinamento_de_valor.md` records. Unknown values travel and the Ledger drops them there.
 */
function listParam(raw: unknown): string[] | undefined {
  const values = (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === "string")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v !== "");
  return values.length > 0 ? [...new Set(values)] : undefined;
}

/**
 * The requested period, or a 400 when it cannot be read.
 *
 * Refused here rather than forwarded: the Ledger validates it too, but its 400 reaches treasury as
 * a failed read and degrades to "unavailable" — which would tell the user the book cannot be
 * reached when in fact the date they typed is unreadable. Those are different answers and must not
 * be collapsed into one. Answering directly also keeps the refusal true wherever this router is
 * mounted, instead of depending on an error boundary above it.
 *
 * Returns null when it already answered; the caller must stop.
 */
function readPeriod(req: Request, res: Response): { from?: string; to?: string } | null {
  const from = strParam(req.query.from);
  const to = strParam(req.query.to);
  for (const [label, value] of [["from", from], ["to", to]] as const) {
    if (value !== undefined && Number.isNaN(new Date(value).getTime())) {
      res.status(400).json({ error: `Invalid date in '${label}' parameter` });
      return null;
    }
  }
  return { from, to };
}

/** Authorization-filtered display of Ledger truth. Read-only; degrades gracefully if Ledger is down. */
export function dashboardRoutes(
  getDashboard: GetTreasuryDashboardUseCase,
  getLifecycle: GetObjectLifecycleUseCase,
  getBookExposure: GetBookExposureUseCase,
  listPositions: ListPositionsUseCase,
  listPayablePositions: ListPayablePositionsUseCase,
  listCashMovements: ListCashMovementsUseCase,
  getLedgerEvent: GetLedgerEventUseCase,
): Router {
  const router = Router();

  router.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = readPeriod(req, res);
      if (!period) return;
      res.json(
        await getDashboard.execute({
          ...period,
          effect: strParam(req.query.effect),
          page: intParam(req.query.page),
          perPage: intParam(req.query.per_page ?? req.query.perPage),
          movementsPage: intParam(req.query.movementsPage),
          status: listParam(req.query.status),
          objectType: listParam(req.query.objectType),
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  // The position math over the whole book — exposure, capital at risk, book health. Separate from
  // /overview because it answers a different question than "how much money moved".
  //
  // The period scopes only the Ledger's cash figures for the window; the exposure totals are
  // current-state and stay whole. Both are published, and the two are never added together.
  router.get("/exposure", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = readPeriod(req, res);
      if (!period) return;
      res.json(await getBookExposure.execute(period));
    } catch (err) {
      next(err);
    }
  });

  // A page of positions, paged by the Ledger. Distinct from the fixed slice /overview carries.
  router.get("/positions", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = readPeriod(req, res);
      if (!period) return;
      res.json(
        await listPositions.execute({
          ...period,
          page: intParam(req.query.page),
          perPage: intParam(req.query.per_page ?? req.query.perPage),
          status: listParam(req.query.status),
          objectType: listParam(req.query.objectType),
          // Accepted under both names: `partyId` is what the Ledger filters, `counterparty` is what
          // the screen calls it. The same question either way — the translation is vocabulary, not
          // a second rule.
          partyId: listParam(req.query.partyId ?? req.query.counterparty),
          outcome: strParam(req.query.outcome),
          sortBy: strParam(req.query.sortBy),
          sortOrder: strParam(req.query.sortOrder),
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * The book's cash movements, paged by the Ledger's cursor.
   *
   * Distinct from the eight `/overview` carries, which are a summary slice scoped to the usina. Here
   * `partyId` is the caller's to give: absent lists the whole book rather than defaulting to us,
   * because "what moved" and "what moved for us" are different questions and one must not silently
   * answer the other.
   */
  router.get("/movements", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = readPeriod(req, res);
      if (!period) return;
      res.json(
        await listCashMovements.execute({
          ...period,
          partyId: strParam(req.query.partyId),
          effect: strParam(req.query.effect),
          limit: intParam(req.query.limit ?? req.query.per_page ?? req.query.perPage),
          // Two paging modes: a cursor continues a walk, a page number jumps. The Ledger settles the
          // conflict when both arrive, and refuses a cursor issued for another ordering.
          cursor: strParam(req.query.cursor),
          page: intParam(req.query.page),
          sortBy: strParam(req.query.sortBy),
          sortOrder: strParam(req.query.sortOrder),
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  // The payable positions behind the upcoming/overdue figures, split by what the book knows about
  // their timing. The totals stay on /exposure — they are the Ledger's own fold over the whole book,
  // and deriving them from this capped list would let the two disagree.
  router.get("/payables", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await listPayablePositions.execute());
    } catch (err) {
      next(err);
    }
  });

  // The life of one economic object: the position and the ordered events that shaped it. 404 means
  // the Ledger knows no such object — not that nothing ever happened to it.
  router.get("/positions/:objectId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lifecycle = await getLifecycle.execute(req.params.objectId);
      if (!lifecycle) {
        res.status(404).json({ error: "Position not found" });
        return;
      }
      res.json(lifecycle);
    } catch (err) {
      next(err);
    }
  });

  // One event, as the Ledger recorded it. This is what makes an eventId actionable: a movement or a
  // lifecycle entry carries the id, and until now there was nowhere to resolve it. 404 means the
  // Ledger knows no such event — never that the event did not happen.
  router.get("/events/:eventId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await getLedgerEvent.execute(req.params.eventId);
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      res.json(event);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
