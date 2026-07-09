import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthService } from "../../../../core/application/services/AuthService";
import type { User } from "../../../../core/domain/entities/User";
import { Permission } from "../../../../core/domain/enums/Permission";
import { can } from "../../../../core/domain/policies/rolePermissions";

export const SESSION_COOKIE = "sid";

/** Request augmented with the resolved user (set by attachUser). */
type AuthedRequest = Request & { user?: User };

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function serializeSessionCookie(
  value: string,
  opts: { maxAgeSeconds: number; secure: boolean },
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${opts.maxAgeSeconds}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export const clearSessionCookie = `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

export function currentUser(req: Request): User {
  const user = (req as AuthedRequest).user;
  if (!user) throw new Error("No authenticated user on request");
  return user;
}

/** Populates req.user from the session cookie when present. Never blocks — that's requireAuth's job. */
export function attachUser(auth: AuthService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (sid) {
        const user = await auth.authenticate(sid);
        if (user) (req as AuthedRequest).user = user;
      }
    } catch {
      /* ignore — treated as unauthenticated */
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!(req as AuthedRequest).user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!can(user.role, permission)) {
      res.status(403).json({ error: "You do not have permission for this action." });
      return;
    }
    next();
  };
}
