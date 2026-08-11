import { Router, type Request, type Response, type NextFunction } from "express";
import type { GetTreasuryDashboardUseCase } from "../../../../core/application/use-cases/GetTreasuryDashboard";
import type { GetObjectLifecycleUseCase } from "../../../../core/application/use-cases/GetObjectLifecycle";
import type { GetBookExposureUseCase } from "../../../../core/application/use-cases/GetBookExposure";
import type { ListPositionsUseCase } from "../../../../core/application/use-cases/ListPositions";
import type { ListPayablePositionsUseCase } from "../../../../core/application/use-cases/ListPayablePositions";
import type { GetLedgerEventUseCase } from "../../../../core/application/use-cases/GetLedgerEvent";

/** Authorization-filtered display of Ledger truth. Read-only; degrades gracefully if Ledger is down. */
export function dashboardRoutes(
  getDashboard: GetTreasuryDashboardUseCase,
  getLifecycle: GetObjectLifecycleUseCase,
  getBookExposure: GetBookExposureUseCase,
  listPositions: ListPositionsUseCase,
  listPayablePositions: ListPayablePositionsUseCase,
  getLedgerEvent: GetLedgerEventUseCase,
): Router {
  const router = Router();

  router.get("/overview", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await getDashboard.execute());
    } catch (err) {
      next(err);
    }
  });

  // The position math over the whole book — exposure, capital at risk, book health. Separate from
  // /overview because it answers a different question than "how much money moved".
  router.get("/exposure", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await getBookExposure.execute());
    } catch (err) {
      next(err);
    }
  });

  // A page of positions, paged by the Ledger. Distinct from the fixed slice /overview carries.
  router.get("/positions", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number.parseInt(String(req.query.page ?? ""), 10);
      res.json(
        await listPositions.execute({
          page: Number.isNaN(page) ? undefined : page,
          status: typeof req.query.status === "string" ? req.query.status : undefined,
          objectType: typeof req.query.objectType === "string" ? req.query.objectType : undefined,
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
