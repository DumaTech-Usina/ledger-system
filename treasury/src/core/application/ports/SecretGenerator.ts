/** Random tokens for sessions and invites, and the one-way hash under which they are stored (REQ-416). */
export interface SecretGenerator {
  newToken(): string;
  hash(token: string): string;
}
