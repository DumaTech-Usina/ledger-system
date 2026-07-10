import type { Request, Response, NextFunction, RequestHandler } from "express";
import { timingSafeEqual } from "crypto";

/**
 * Guards service-to-service write endpoints with a Bearer token. Fails CLOSED: if no token is
 * configured, the endpoint refuses all requests (a financial write surface must never be open by
 * default).
 */
export function requireServiceToken(expectedToken: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!expectedToken) {
      res.status(503).json({ error: "Submit endpoint is not configured (no service token set)." });
      return;
    }
    const header = req.headers["authorization"];
    const provided = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
    const a = Buffer.from(provided);
    const b = Buffer.from(expectedToken);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) {
      res.status(401).json({ error: "Invalid service token." });
      return;
    }
    next();
  };
}
