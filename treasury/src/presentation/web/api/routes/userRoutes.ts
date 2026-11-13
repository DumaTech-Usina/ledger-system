import { Router, type NextFunction, type Request, type Response } from "express";
import { AccessError, type UserAdministrationService } from "../../../../core/application/services/UserAdministrationService";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";
import { sendAccessError } from "./accessErrors";

/**
 * The users screen (REQ-440). The route refuses anyone without user management (REQ-430), and the
 * service checks again, so no other path can reach these acts. The author of each act is the user of
 * the session, never something in the body (REQ-807).
 */
export function userRoutes(userAdmin: UserAdministrationService): Router {
  const router = Router();
  router.use(requirePermission(Permission.USER_MANAGE));

  const handle =
    (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fn(req, res);
      } catch (err) {
        if (err instanceof AccessError) sendAccessError(res, err);
        else next(err);
      }
    };

  router.get("/", handle(async (req, res) => {
    res.json(await userAdmin.list(currentUser(req)));
  }));

  /** REQ-420, REQ-421: inviting the same e-mail again is the "resend". */
  router.post("/invites", handle(async (req, res) => {
    const { email, role } = req.body ?? {};
    res.status(201).json(await userAdmin.invite(currentUser(req), String(email ?? ""), role));
  }));

  router.post("/:userId/deactivate", handle(async (req, res) => {
    await userAdmin.deactivate(currentUser(req), req.params.userId);
    res.json({ ok: true });
  }));

  router.post("/:userId/role", handle(async (req, res) => {
    await userAdmin.changeRole(currentUser(req), req.params.userId, (req.body ?? {}).role);
    res.json({ ok: true });
  }));

  router.post("/:userId/curation", handle(async (req, res) => {
    await userAdmin.setCuration(currentUser(req), req.params.userId, (req.body ?? {}).curator === true);
    res.json({ ok: true });
  }));

  return router;
}
