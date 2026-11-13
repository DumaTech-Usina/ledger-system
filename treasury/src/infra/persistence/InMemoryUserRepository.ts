import type { User } from "../../core/domain/entities/User";
import type { UserRepository } from "../../core/application/repositories/UserRepository";

/** Users in memory, for tests. No delete, as in the SQLite store (REQ-403). */
export class InMemoryUserRepository implements UserRepository {
  private readonly users: User[];

  constructor(initial: User[] = []) {
    this.users = [...initial];
  }

  async findActiveByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email && u.isActive) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async list(): Promise<User[]> {
    return [...this.users];
  }

  async save(user: User): Promise<void> {
    const index = this.users.findIndex((u) => u.id === user.id);
    if (index === -1) this.users.push(user);
    else this.users[index] = user;
  }
}
