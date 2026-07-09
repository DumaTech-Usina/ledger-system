import type { User } from "../../core/domain/entities/User";
import type { UserRepository } from "../../core/application/repositories/UserRepository";

/** MVP user store seeded at composition time. Swappable for a real store later. */
export class InMemoryUserRepository implements UserRepository {
  constructor(private readonly users: User[]) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username === username) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }
}
