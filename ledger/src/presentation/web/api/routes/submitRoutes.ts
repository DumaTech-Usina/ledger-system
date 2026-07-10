import { Router, type Request, type Response, type NextFunction } from "express";
import type { SubmitCandidateUseCase } from "../../../../core/application/use-cases/SubmitCandidateUseCase";
import type { SubmitCandidateInput } from "../../../../core/application/dtos/SubmitCandidateInput";

/**
 * POST /api/intents/submit — the User App ↔ Ledger submission endpoint. Validates + posts the
 * candidate synchronously and returns a business outcome. The idempotency key (header, falling back
 * to the candidate's source reference) makes retries safe.
 */
export function submitRoutes(submitCandidate: SubmitCandidateUseCase): Router {
  const router = Router();

  router.post("/submit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as SubmitCandidateInput;
      if (!input || typeof input.sourceReference !== "string") {
        res.status(400).json({ error: "Invalid candidate payload." });
        return;
      }
      const idempotencyKey = (req.headers["idempotency-key"] as string) || input.sourceReference;
      res.status(200).json(await submitCandidate.execute(input, idempotencyKey));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
