import { Router, type Request, type Response, type NextFunction } from "express";
import type { ListPartiesUseCase } from "../../../../core/application/use-cases/ListParties";
import type { RenamePartyUseCase } from "../../../../core/application/use-cases/RenameParty";
import { Permission } from "../../../../core/domain/enums/Permission";
import { requirePermission } from "../middleware/auth";

/**
 * The Party Directory's own read/write surface — distinct from both `/api/dashboard` (Ledger-derived
 * read data) and `/api/conversation` (guided-dialog flows): a counterparty is looked up and edited
 * directly here, with no intent involved. Each route carries its own permission (list is a read
 * anyone with dashboard access has; rename is a write, scoped like any other submitting action)
 * rather than one shared gate at the mount point, since the two don't share a common floor.
 */
export function partyRoutes(listParties: ListPartiesUseCase, renameParty: RenamePartyUseCase): Router {
  const router = Router();

  router.get(
    "/",
    requirePermission(Permission.DASHBOARD_READ),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(await listParties.execute());
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/:partyId/rename",
    requirePermission(Permission.INTENT_SUBMIT),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { displayName } = req.body ?? {};
        if (typeof displayName !== "string") {
          res.status(400).json({ error: "displayName is required." });
          return;
        }
        res.json(await renameParty.execute({ partyId: req.params.partyId, displayName }));
      } catch (err) {
        // Unknown party / blank name are the caller's to fix, not a fault.
        res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  return router;
}
