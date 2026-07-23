import { Router, type Request, type Response, type NextFunction } from "express";
import { listScenarios } from "../../../../core/domain/scenarios/Scenario";
import type { StartIntentUseCase } from "../../../../core/application/use-cases/StartIntent";
import type { AdvanceDialogUseCase } from "../../../../core/application/use-cases/AdvanceDialog";
import type { ApplyAnswersUseCase } from "../../../../core/application/use-cases/ApplyAnswers";
import type { InterpretUtteranceUseCase } from "../../../../core/application/use-cases/InterpretUtterance";
import type { PreviewIntentUseCase } from "../../../../core/application/use-cases/PreviewIntent";
import type { SubmitIntentUseCase } from "../../../../core/application/use-cases/SubmitIntent";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";

/**
 * Drives the guided conversation: list scenarios, start an intent, answer one slot at a time,
 * preview (confirm-before-commit), and submit. The intent is attributed to the authenticated user.
 */
export function conversationRoutes(
  startIntent: StartIntentUseCase,
  advanceDialog: AdvanceDialogUseCase,
  applyAnswers: ApplyAnswersUseCase,
  interpretUtterance: InterpretUtteranceUseCase,
  previewIntent: PreviewIntentUseCase,
  submitIntent: SubmitIntentUseCase,
): Router {
  const router = Router();

  router.get("/scenarios", (_req: Request, res: Response) => {
    res.json({
      scenarios: listScenarios().map((s) => ({ id: s.id, title: s.title, description: s.description })),
    });
  });

  router.post("/start", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scenarioId } = req.body ?? {};
      const result = await startIntent.execute({ scenarioId, userId: currentUser(req).id });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:intentId/answer", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key, value } = req.body ?? {};
      const result = await advanceDialog.execute({ intentId: req.params.intentId, key, value });
      res.status(result.error ? 422 : 200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:intentId/apply", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answers, mode } = req.body ?? {};
      const result = await applyAnswers.execute({ intentId: req.params.intentId, answers: answers ?? [], mode });
      res.status(result.rejected.length ? 422 : 200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // First utterance, no scenario chosen yet: classify → create the intent → merge (or clarify).
  router.post("/interpret", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { utterance } = req.body ?? {};
      const result = await interpretUtterance.execute({ utterance: utterance ?? "", userId: currentUser(req).id });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Continue an existing intent from free text (scenario already bound).
  router.post("/:intentId/interpret", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { utterance } = req.body ?? {};
      const result = await interpretUtterance.execute({
        intentId: req.params.intentId,
        utterance: utterance ?? "",
        userId: currentUser(req).id,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:intentId/preview", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await previewIntent.execute(req.params.intentId));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/:intentId/submit",
    requirePermission(Permission.INTENT_SUBMIT),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(await submitIntent.execute(req.params.intentId));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
