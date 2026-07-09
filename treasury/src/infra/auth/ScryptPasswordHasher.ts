import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { PasswordHasher, HashedPassword } from "../../core/application/ports/PasswordHasher";

/** scrypt-based hasher using Node's built-in crypto — no external dependency. */
export class ScryptPasswordHasher implements PasswordHasher {
  private readonly keyLen = 64;

  hash(password: string): HashedPassword {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, this.keyLen).toString("hex");
    return { hash, salt };
  }

  verify(password: string, hash: string, salt: string): boolean {
    const candidate = scryptSync(password, salt, this.keyLen);
    const stored = Buffer.from(hash, "hex");
    // Length check guards timingSafeEqual (which throws on length mismatch).
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  }
}
