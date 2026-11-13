import { Router, type NextFunction, type Request, type Response } from "express";
import type { AuthService } from "../../../../core/application/services/AuthService";
import { AccessError, type UserAdministrationService } from "../../../../core/application/services/UserAdministrationService";
import {
  serializeSessionCookie,
  clearSessionCookie,
  requireAuth,
  currentUser,
  sessionToken,
} from "../middleware/auth";
import { sendAccessError } from "./accessErrors";

/** REQ-413: one answer for every refused login, whatever the reason. */
const LOGIN_REFUSED = { error: "invalid_credentials", message: "E-mail ou senha inválidos." };

/** The public routes of §6, kept in one place so the API gate (REQ-410) lists exactly these. */
export const PUBLIC_AUTH_ROUTES = ["POST /api/auth/login", "POST /api/auth/invites/accept"] as const;

export function authRoutes(
  auth: AuthService,
  secureCookies: boolean,
  sessionTtlSeconds: number,
  userAdmin?: UserAdministrationService,
): Router {
  const router = Router();

  router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body ?? {};
      const result = await auth.login(String(email ?? ""), String(password ?? ""));
      if (!result) {
        res.status(401).json(LOGIN_REFUSED);
        return;
      }
      res.setHeader("Set-Cookie", serializeSessionCookie(result.sessionId, { maxAgeSeconds: sessionTtlSeconds, secure: secureCookies }));
      res.json({ user: result.user.toPublic() });
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sid = sessionToken(req);
      if (sid) await auth.logout(sid);
      res.setHeader("Set-Cookie", clearSessionCookie);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get("/me", requireAuth, (req: Request, res: Response) => {
    res.json({ user: currentUser(req).toPublic() });
  });

  /** REQ-422: the person behind an invite link sets the password and, optionally, the name. */
  router.post("/invites/accept", async (req: Request, res: Response, next: NextFunction) => {
    if (!userAdmin) {
      res.status(404).end();
      return;
    }
    try {
      const { token, password, name } = req.body ?? {};
      await userAdmin.acceptInvite(String(token ?? ""), String(password ?? ""), name == null ? null : String(name));
      res.status(201).json({ ok: true });
    } catch (err) {
      if (err instanceof AccessError) sendAccessError(res, err);
      else next(err);
    }
  });

  return router;
}
