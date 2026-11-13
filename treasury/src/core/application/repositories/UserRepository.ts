import type { User } from "../../domain/entities/User";

/** Users are saved and read, never deleted (REQ-403). */
export interface UserRepository {
  /** The active user with this (normalized) e-mail. A deactivated one is never returned here. */
  findActiveByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Everyone, active and deactivated, oldest first (REQ-440). */
  list(): Promise<User[]>;
  /** Inserts a new user or replaces the stored state of an existing one. */
  save(user: User): Promise<void>;
}
