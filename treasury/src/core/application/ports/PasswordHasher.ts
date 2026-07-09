export interface HashedPassword {
  hash: string;
  salt: string;
}

/** Password hashing boundary — injected so the crypto choice stays in infrastructure. */
export interface PasswordHasher {
  hash(password: string): HashedPassword;
  verify(password: string, hash: string, salt: string): boolean;
}
