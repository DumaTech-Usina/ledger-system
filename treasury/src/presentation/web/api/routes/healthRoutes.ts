import { Router, type Request, type Response } from "express";

/**
 * Liveness (`/health`) and readiness (`/ready`) for the orchestrator — same pattern as the
 * Ledger. The MVP has no external dependencies yet, so readiness is trivially ready; it will
 * grow real checks (datastore, Ledger reachability) as those adapters land.
 */
export function healthRoutes(): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/ready", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ready" });
  });

  return router;
}
