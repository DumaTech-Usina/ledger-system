/** REQ-415, mirrored for the screen. The server is what refuses (REQ-430); this only spares a round trip. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordProblem = "too_short" | "too_long" | "mismatch" | null;

export function passwordProblem(password: string, confirmation: string): PasswordProblem {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return "too_short";
  if (length > PASSWORD_MAX_LENGTH) return "too_long";
  if (password !== confirmation) return "mismatch";
  return null;
}

/** The server's answer to an acceptance, worded for the person. One message for any unusable link (EX-403). */
export function acceptErrorMessage(code: string | undefined): string {
  if (code === "invalid_password") return `A senha precisa ter de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`;
  return "Este link de convite não vale mais. Peça um novo ao administrador.";
}
