/** The numbers of §6, in one place. Each one is a rule of the template, not a tuning knob. */

/** REQ-415: 12 to 128 characters, no composition rule. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** REQ-414: 5 failures in a row suspend the account's login for 15 minutes. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_SUSPENSION_MS = 15 * 60_000;

/** REQ-412: absolute, from the login, whatever the use in between. */
export const SESSION_TTL_MS = 12 * 3_600_000;

/** REQ-420: an invite link is good for 72 hours. */
export const INVITE_TTL_MS = 72 * 3_600_000;

export function passwordProblem(password: string): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (length > PASSWORD_MAX_LENGTH) return `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  return null;
}

/** REQ-400: the e-mail is the login, compared without surrounding spaces or letter case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
