import { Router, type Request, type Response } from "express";
import type { AuthService } from "../../../../core/application/services/AuthService";
import type { User } from "../../../../core/domain/entities/User";
import { permissionsFor } from "../../../../core/domain/policies/rolePermissions";
import {
  parseCookies,
  serializeSessionCookie,
  clearSessionCookie,
  requireAuth,
  currentUser,
  SESSION_COOKIE,
} from "../middleware/auth";

const publicUser = (user: User) => ({ ...user.toPublic(), permissions: permissionsFor(user.role) });

export function authRoutes(auth: AuthService, secureCookies: boolean, sessionTtlSeconds: number): Router {
  const router = Router();

  router.post("/login", async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    const result = await auth.login(String(username ?? ""), String(password ?? ""));
    if (!result) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }
    res.setHeader("Set-Cookie", serializeSessionCookie(result.sessionId, { maxAgeSeconds: sessionTtlSeconds, secure: secureCookies }));
    res.json({ user: publicUser(result.user) });
  });

  router.post("/logout", (req: Request, res: Response) => {
    const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (sid) auth.logout(sid);
    res.setHeader("Set-Cookie", clearSessionCookie);
    res.json({ ok: true });
  });

  router.get("/me", requireAuth, (req: Request, res: Response) => {
    res.json({ user: publicUser(currentUser(req)) });
  });

  return router;
}
