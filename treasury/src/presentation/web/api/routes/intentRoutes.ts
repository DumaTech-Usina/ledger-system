import { Router, type Request, type Response, type NextFunction } from "express";
import type { GetIntentUseCase } from "../../../../core/application/use-cases/GetIntent";
import type { ListIntentsUseCase } from "../../../../core/application/use-cases/ListIntents";
import { currentUser } from "../middleware/auth";

/** Read side for the workspace: list a user's intents and fetch one with its lifecycle history. */
export function intentRoutes(
  getIntent: GetIntentUseCase,
  listIntents: ListIntentsUseCase,
): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ intents: await listIntents.execute(currentUser(req).id) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:intentId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await getIntent.execute(req.params.intentId));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
