import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthService } from "../../../../core/application/services/AuthService";
import type { User } from "../../../../core/domain/entities/User";
import { Permission } from "../../../../core/domain/enums/Permission";

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

/** An opaque token in an HttpOnly, SameSite=Strict cookie; Secure in production (§6, template annex A). */
export function serializeSessionCookie(value: string, opts: { maxAgeSeconds: number; secure: boolean }): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${opts.maxAgeSeconds}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export const clearSessionCookie = `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`;

export function sessionToken(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

export function currentUser(req: Request): User {
  const user = (req as AuthedRequest).user;
  if (!user) throw new Error("No authenticated user on request");
  return user;
}

/** Populates req.user from the session cookie when present. Never blocks — the guards do. */
export function attachUser(auth: AuthService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const sid = sessionToken(req);
      if (sid) {
        const user = await auth.authenticate(sid);
        if (user) (req as AuthedRequest).user = user;
      }
    } catch {
      /* treated as unauthenticated */
    }
    next();
  };
}

const AUTHENTICATION_REQUIRED = { error: "Authentication required." };

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!(req as AuthedRequest).user) {
    res.status(401).json(AUTHENTICATION_REQUIRED);
    return;
  }
  next();
}

/**
 * REQ-410: everything under the API needs a session, except a closed list. A route added tomorrow is
 * protected without anyone remembering to protect it.
 */
export function requireAuthExcept(publicRoutes: readonly string[]): RequestHandler {
  const open = new Set(publicRoutes);
  return (req: Request, res: Response, next: NextFunction) => {
    if (open.has(`${req.method} ${req.path}`)) {
      next();
      return;
    }
    requireAuth(req, res, next);
  };
}

/** REQ-430, REQ-431: no session is a 401; a session without the permission is a 403. */
export function requirePermission(permission: Permission): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      res.status(401).json(AUTHENTICATION_REQUIRED);
      return;
    }
    if (!user.can(permission)) {
      res.status(403).json({ error: "You do not have permission for this action." });
      return;
    }
    next();
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * REQ-417: a request that changes data, sent by a page from another site, is refused even with an
 * open session. The browser names the page's origin; it must be the Treasury itself (the same host
 * the request reached) or one of the trusted origins. A request without an Origin is not from a page
 * of another site and passes.
 */
export function rejectForeignOrigin(trustedOrigins: readonly string[]): RequestHandler {
  const trusted = new Set(trustedOrigins.map((o) => originOf(o)).filter((o): o is string => o !== null));
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.has(req.method) || !origin) {
      next();
      return;
    }
    const parsed = originOf(origin);
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === req.headers.host;
    } catch {
      sameHost = false;
    }
    if (sameHost || (parsed !== null && trusted.has(parsed))) {
      next();
      return;
    }
    res.status(403).json({ error: "Request from another site refused." });
  };
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
