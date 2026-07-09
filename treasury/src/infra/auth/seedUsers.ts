import { User } from "../../core/domain/entities/User";
import { Role } from "../../core/domain/enums/Role";
import type { PasswordHasher } from "../../core/application/ports/PasswordHasher";

export interface UserSeed {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  password: string;
}

/** Builds seed users with hashed passwords. Seed credentials come from env (dev defaults only). */
export function seedUsers(hasher: PasswordHasher, seeds: UserSeed[]): User[] {
  return seeds.map((s) => {
    const { hash, salt } = hasher.hash(s.password);
    return new User({
      id: s.id,
      username: s.username,
      displayName: s.displayName,
      role: s.role,
      passwordHash: hash,
      passwordSalt: salt,
    });
  });
}
