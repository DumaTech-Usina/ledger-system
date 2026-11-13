import { createHash, randomBytes } from "node:crypto";
import type { SecretGenerator } from "../../core/application/ports/SecretGenerator";

/** 256-bit random tokens, stored only as their SHA-256 (REQ-416). */
export class CryptoSecretGenerator implements SecretGenerator {
  newToken(): string {
    return randomBytes(32).toString("base64url");
  }

  hash(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }
}
