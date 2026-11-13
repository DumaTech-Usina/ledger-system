import type { Response } from "express";
import type { AccessError, AccessErrorCode } from "../../../../core/application/services/UserAdministrationService";

const STATUS: Record<AccessErrorCode, number> = {
  forbidden: 403,
  not_found: 404,
  invalid_email: 400,
  invalid_role: 400,
  invalid_password: 400,
  invalid_invite: 400,
  active_user: 409,
  last_admin: 409,
  admin_exists: 409,
};

/**
 * A refusal of §6 as HTTP. The body is just the code: an invalid invite says nothing about why
 * (EX-403), and the client words each code in the user's language.
 */
export function sendAccessError(res: Response, err: AccessError): void {
  res.status(STATUS[err.code]).json({ error: err.code });
}
