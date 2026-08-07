import { Router, Request, Response, NextFunction } from "express";
import { LedgerEventRepository } from "../../../../core/application/repositories/LedgerEventRepository";
import { Relation } from "../../../../core/domain/enums/Relation";
import { normalizePageOptions, PageOptions } from "../../../../core/application/dtos/Pagination";
import { retractedEventIds } from "../../../../core/application/dtos/retractionUtils";
import { serializeEvent } from "../serializers/eventSerializer";

async function buildSettledSet(
  repo: LedgerEventRepository,
  originatedIds: Set<string>,
): Promise<Set<string>> {
  const settled = new Set<string>();
  await Promise.all(
    [...originatedIds].map(async (objectId) => {
      const related = await repo.findByObjectId(objectId);
      for (const e of related) {
        for (const obj of e.getObjects()) {
          if (obj.relation === Relation.SETTLES && obj.objectId.value === objectId) {
            settled.add(objectId);
          }
        }
      }
    }),
  );
  return settled;
}

export function eventRoutes(ledgerRepo: LedgerEventRepository): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // sortBy/sortOrder are passed through so a consumer can read the book by recordedAt — "what
      // was written since I last looked", which occurredAt cannot answer because a fact may be
      // recorded long after it happened. normalizePageOptions drops anything it does not admit.
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
        sortBy: req.query.sortBy as PageOptions["sortBy"],
        sortOrder: req.query.sortOrder as PageOptions["sortOrder"],
      });
      const { data: events, total, page, limit, totalPages } =
        await ledgerRepo.findPaginated(options);

      const originatedIds = new Set<string>();
      for (const event of events) {
        for (const obj of event.getObjects()) {
          if (obj.relation === Relation.ORIGINATES) originatedIds.add(obj.objectId.value);
        }
      }
      const settledIds = await buildSettledSet(ledgerRepo, originatedIds);

      const data = events.map((event) => ({
        ...serializeEvent(event),
        hasOpenPosition: event.getObjects().some(
          (o) => o.relation === Relation.ORIGINATES && !settledIds.has(o.objectId.value),
        ),
      }));

      res.json({ data, total, page, limit, totalPages });
    } catch (err) {
      next(err);
    }
  });

  router.get("/feed", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
        sortBy: "occurredAt",
        sortOrder: "DESC",
      });

      const { data: pageEvents, total, totalPages } =
        await ledgerRepo.findPaginated(options);

      const payload = await Promise.all(
        pageEvents.map(async (event) => {
          const primaryObjectId = event.getObjects()[0]?.objectId.value;
          const allPosEvents = primaryObjectId
            ? await ledgerRepo.findByObjectId(primaryObjectId)
            : [event];

          // The chain and the status describe what still STANDS, so they read the position the same
          // way /api/positions does. A retracted event is part of the history, not of the state.
          const retracted = retractedEventIds(allPosEvents);
          const posEvents = allPosEvents.filter((e) => !retracted.has(e.id.value));

          const allRels = posEvents.flatMap((e) => e.getObjects().map((o) => o.relation));
          const positionStatus = allRels.includes(Relation.REVERSES)
            ? "estornada"
            : allRels.includes(Relation.SETTLES)
              ? "liquidada"
              : "aberta";

          const posTs = posEvents.map((e) => e.occurredAt.getTime());
          const posOriginalDate = new Date(Math.min(...posTs));
          const daysOpen =
            positionStatus === "aberta"
              ? Math.floor((Date.now() - posOriginalDate.getTime()) / 86_400_000)
              : 0;

          const sortedChain = [...posEvents].sort(
            (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
          );

          return {
            ...serializeEvent(event),
            positionStatus,
            positionDaysOpen: daysOpen,
            positionOriginalDate: posOriginalDate.toISOString(),
            positionChain: sortedChain.map((e) => ({
              id: e.id.value,
              relation: e.getObjects()[0]?.relation ?? "references",
              occurredAt: e.occurredAt,
              amount: e.amount.toString(),
              economicEffect: e.economicEffect,
            })),
          };
        }),
      );

      res.json({ data: payload, total, page: options.page, limit: options.limit, totalPages });
    } catch (err) {
      next(err);
    }
  });

  /**
   * A single event by id. Declared AFTER `/feed` so the literal route wins over the parameter.
   *
   * A producer that wants to rectify an event needs to know what that event asserted — its amount,
   * and the object it moved. Without this, the only way to build a correction is to retype figures
   * the ledger already holds, which invites a correction that disagrees with what it corrects.
   * Read-only: it serializes the stored event and derives nothing.
   */
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await ledgerRepo.getById(req.params.id);
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      res.json(serializeEvent(event));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
