import { Router, Request, Response } from "express";

/** Per-dependency reachability, resolved by a probe injected from the composition root. */
export interface ReadinessChecks {
  postgres: boolean;
  mongo: boolean;
}

/** Pings the datastores the service needs to serve traffic. Never throws — a failed
 *  dependency is reported as `false`, not an exception. */
export type ReadinessProbe = () => Promise<ReadinessChecks>;

/**
 * Liveness (`/health`) and readiness (`/ready`) probes for the orchestrator.
 *
 * Liveness answers "is the process alive?" — it makes no dependency calls, so a transient
 * database blip can never trigger a restart loop. Readiness answers "can it serve traffic
 * right now?" by pinging Postgres and Mongo; when a dependency is down it returns 503 so the
 * platform routes traffic away *without* killing the process.
 */
export function healthRoutes(readiness: ReadinessProbe): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/ready", async (_req: Request, res: Response) => {
    const checks = await readiness();
    const ready = checks.postgres && checks.mongo;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "unready",
      checks,
    });
  });

  return router;
}
