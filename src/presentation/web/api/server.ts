import express, { Request, Response, NextFunction } from "express";
import * as path from "path";
import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { StagingRepository } from "../../../core/application/repositories/StagingRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { Relation } from "../../../core/domain/enums/Relation";

interface ServerDeps {
  ledgerRepo: LedgerEventRepository;
  rejectedRepo: RejectedEventRepository;
  stagingRepo: StagingRepository;
}

/**
 * An event has an open position when it originated an economic object that
 * has not yet been settled by any other event in the ledger.
 */
function hasOpenPosition(event: LedgerEvent, allEvents: LedgerEvent[]): boolean {
  const originatedIds = new Set(
    event
      .getObjects()
      .filter((o) => o.relation === Relation.ORIGINATES)
      .map((o) => o.objectId.value),
  );

  if (originatedIds.size === 0) return false;

  for (const other of allEvents) {
    if (other.id.value === event.id.value) continue;
    for (const obj of other.getObjects()) {
      if (obj.relation === Relation.SETTLES) {
        originatedIds.delete(obj.objectId.value);
      }
    }
  }

  return originatedIds.size > 0;
}

export function createServer(deps: ServerDeps) {
  const app = express();

  // ── Static dashboard ──────────────────────────────────────────────────────
  const clientDir = path.join(__dirname, "..", "client");
  app.use(express.static(clientDir));

  // ── GET /api/staging ──────────────────────────────────────────────────────
  app.get("/api/staging", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const records = await deps.stagingRepo.findAll();
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/events ───────────────────────────────────────────────────────
  app.get("/api/events", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await deps.ledgerRepo.findAll();

      const payload = events.map((event) => {
        const reason = event.getReason();
        const reporter = event.getReporter();

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
          hasOpenPosition: hasOpenPosition(event, events),
        };
      });

      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/events/feed ─────────────────────────────────────────────────
  app.get("/api/events/feed", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitParam = parseInt((req.query.limit as string) || "50", 10);
      const limit = isNaN(limitParam) ? 50 : Math.min(Math.max(1, limitParam), 200);

      const all = await deps.ledgerRepo.findAll();
      const sorted = [...all].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
      const page = sorted.slice(0, limit);

      const payload = page.map((event) => {
        const primaryObjectId = event.getObjects()[0]?.objectId.value;
        const posEvents = primaryObjectId
          ? all.filter((e) => e.getObjects().some((o) => o.objectId.value === primaryObjectId))
          : [event];

        const allRels = posEvents.flatMap((e) => e.getObjects().map((o) => o.relation));
        const positionStatus = allRels.includes(Relation.REVERSES)
          ? "estornada"
          : allRels.includes(Relation.SETTLES)
            ? "liquidada"
            : "aberta";

        const posTs = posEvents.map((e) => new Date(e.occurredAt).getTime());
        const posOriginalDate = new Date(Math.min(...posTs));
        const daysOpen =
          positionStatus === "aberta"
            ? Math.floor((Date.now() - posOriginalDate.getTime()) / 86_400_000)
            : 0;

        const reason = event.getReason();
        const reporter = event.getReporter();

        const sortedChain = [...posEvents].sort(
          (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
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
      });

      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/events/rejected ──────────────────────────────────────────────
  app.get("/api/events/rejected", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await deps.rejectedRepo.findAll();

      const payload = events.map((event) => ({
        id: event.id.value,
        stagingId: event.stagingId.value,
        rejectedAt: event.rejectedAt,
        reasons: event.reasons.map((r) => ({
          type: r.type,
          description: r.description,
        })),
        rawPayload: event.rawPayload ?? null,
      }));

      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return app;
}
