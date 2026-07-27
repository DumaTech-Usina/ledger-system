import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { listScenarios } from "../../../../core/domain/scenarios/Scenario";
import type { StartIntentUseCase } from "../../../../core/application/use-cases/StartIntent";
import type { AdvanceDialogUseCase } from "../../../../core/application/use-cases/AdvanceDialog";
import type { PreviewIntentUseCase } from "../../../../core/application/use-cases/PreviewIntent";
import type { SubmitIntentUseCase } from "../../../../core/application/use-cases/SubmitIntent";
import type { ExtractAndApplyDocumentUseCase } from "../../../../core/application/use-cases/ExtractAndApplyDocument";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";

/** Accepted upload formats for document extraction — kept here (HTTP plumbing), never leaked into the extraction module itself. */
const ACCEPTED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/xml",
  "application/xml",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ACCEPTED_UPLOAD_MIME_TYPES.has(file.mimetype)),
});

/**
 * Drives the guided conversation: list scenarios, start an intent, answer one slot at a time,
 * preview (confirm-before-commit), and submit. The intent is attributed to the authenticated user.
 */
export function conversationRoutes(
  startIntent: StartIntentUseCase,
  advanceDialog: AdvanceDialogUseCase,
  previewIntent: PreviewIntentUseCase,
  submitIntent: SubmitIntentUseCase,
  extractAndApplyDocument: ExtractAndApplyDocumentUseCase,
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

  router.post(
    "/:intentId/extract",
    upload.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "Nenhum arquivo enviado ou formato não permitido." });
          return;
        }
        const result = await extractAndApplyDocument.execute({
          intentId: req.params.intentId,
          file: { buffer: req.file.buffer, mimeType: req.file.mimetype, filename: req.file.originalname },
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

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
