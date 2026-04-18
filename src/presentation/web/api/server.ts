import express, { Request, Response, NextFunction } from "express";
import * as path from "path";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { StagingRepository } from "../../../core/application/repositories/StagingRepository";
import { Relation } from "../../../core/domain/enums/Relation";
import { normalizePageOptions } from "../../../core/application/dtos/Pagination";

interface ServerDeps {
  ledgerRepo: LedgerEventRepository;
  rejectedRepo: RejectedEventRepository;
  stagingRepo: StagingRepository;
}

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

export function createServer(deps: ServerDeps) {
  const app = express();

  // ── Static dashboard ──────────────────────────────────────────────────────
  const clientDir = path.join(__dirname, "..", "client");
  app.use(express.static(clientDir));

  // ── GET /api/staging ──────────────────────────────────────────────────────
  app.get("/api/staging", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
      });
      const page = await deps.stagingRepo.findPaginated(options);
      res.json(page);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/events ───────────────────────────────────────────────────────
  app.get("/api/events", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
      });
      const { data: events, total, page, limit, totalPages } =
        await deps.ledgerRepo.findPaginated(options);

      const originatedIds = new Set<string>();
      for (const event of events) {
        for (const obj of event.getObjects()) {
          if (obj.relation === Relation.ORIGINATES) originatedIds.add(obj.objectId.value);
        }
      }
      const settledIds = await buildSettledSet(deps.ledgerRepo, originatedIds);

      const data = events.map((event) => {
        const reason = event.getReason();
        const reporter = event.getReporter();
        const hasOpenPosition = event.getObjects().some(
          (o) => o.relation === Relation.ORIGINATES && !settledIds.has(o.objectId.value),
        );

        return {
          id: event.id.value,
          eventType: event.eventType,
          economicEffect: event.economicEffect,
          occurredAt: event.occurredAt,
          recordedAt: event.recordedAt,
          amount: event.amount.toString(),
          currency: event.amount.currency,
          description: event.description,
          source: {
            system: event.source.system,
            reference: event.source.reference,
          },
          normalization: {
            version: event.normalization.version,
            workerId: event.normalization.workerId,
          },
          parties: event.getParties().map((p) => ({
            partyId: p.partyId.value,
            role: p.role,
            direction: p.direction,
            amount: p.amount?.toString() ?? null,
          })),
          objects: event.getObjects().map((o) => ({
            objectId: o.objectId.value,
            objectType: o.objectType,
            relation: o.relation,
          })),
          reason: reason
            ? {
                type: reason.type,
                description: reason.description,
                confidence: reason.confidence,
                requiresFollowup: reason.requiresFollowup,
              }
            : null,
          reporter: {
            reporterType: reporter.reporterType,
            reporterId: reporter.reporterId,
            reporterName: reporter.reporterName,
            reportedAt: reporter.reportedAt,
            channel: reporter.channel,
          },
          hash: event.hash.value,
          previousHash: event.previousHash?.value ?? null,
          hasOpenPosition,
        };
      });

      res.json({ data, total, page, limit, totalPages });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/events/feed ─────────────────────────────────────────────────
  app.get("/api/events/feed", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
        sortBy: 'occurredAt',
        sortOrder: 'DESC',
      });

      const { data: pageEvents, total, totalPages } =
        await deps.ledgerRepo.findPaginated(options);

      const payload = await Promise.all(
        pageEvents.map(async (event) => {
          const primaryObjectId = event.getObjects()[0]?.objectId.value;
          const posEvents = primaryObjectId
            ? await deps.ledgerRepo.findByObjectId(primaryObjectId)
            : [event];

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

          const reason = event.getReason();
          const reporter = event.getReporter();

          const sortedChain = [...posEvents].sort(
            (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
          );

          return {
            id: event.id.value,
            eventType: event.eventType,
            economicEffect: event.economicEffect,
            occurredAt: event.occurredAt,
            recordedAt: event.recordedAt,
            amount: event.amount.toString(),
            currency: event.amount.currency,
            hash: event.hash.value,
            source: { system: event.source.system, reference: event.source.reference },
            normalization: {
              version: event.normalization.version,
              workerId: event.normalization.workerId,
            },
            parties: event.getParties().map((p) => ({
              partyId: p.partyId.value,
              role: p.role,
              direction: p.direction,
              amount: p.amount?.toString() ?? null,
            })),
            objects: event.getObjects().map((o) => ({
              objectId: o.objectId.value,
              objectType: o.objectType,
              relation: o.relation,
            })),
            reason: reason
              ? {
                  type: reason.type,
                  description: reason.description,
                  confidence: reason.confidence,
                  requiresFollowup: reason.requiresFollowup,
                }
              : null,
            reporter: {
              reporterType: reporter.reporterType,
              reporterId: reporter.reporterId,
              reporterName: reporter.reporterName,
              reportedAt: reporter.reportedAt,
              channel: reporter.channel,
            },
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

  // ── GET /api/events/rejected ──────────────────────────────────────────────
  app.get("/api/events/rejected", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = normalizePageOptions({
        page: parseInt(req.query.page as string, 10) || undefined,
        limit: parseInt(req.query.limit as string, 10) || undefined,
      });
      const { data: events, total, page, limit, totalPages } =
        await deps.rejectedRepo.findPaginated(options);

      const data = events.map((event) => ({
        id: event.id.value,
        stagingId: event.stagingId.value,
        rejectedAt: event.rejectedAt,
        reasons: event.reasons.map((r) => ({
          type: r.type,
          description: r.description,
        })),
        rawPayload: event.rawPayload ?? null,
      }));

      res.json({ data, total, page, limit, totalPages });
    } catch (err) {
      next(err);
    }
  });

  return app;
}
