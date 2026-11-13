import type { Invite } from "../../core/domain/entities/Invite";
import type { InviteRepository } from "../../core/application/repositories/InviteRepository";

/** Invites in memory, for tests. */
export class InMemoryInviteRepository implements InviteRepository {
  private readonly invites: Invite[] = [];

  async save(invite: Invite): Promise<void> {
    const index = this.invites.findIndex((i) => i.id === invite.id);
    if (index === -1) this.invites.push({ ...invite });
    else this.invites[index] = { ...invite };
  }

  async findByTokenHash(tokenHash: string): Promise<Invite | null> {
    return this.invites.find((i) => i.tokenHash === tokenHash) ?? null;
  }

  async listPending(): Promise<Invite[]> {
    return this.invites.filter((i) => i.status === "pending");
  }

  /** Every invite ever issued, whatever its status. For tests. */
  all(): Invite[] {
    return [...this.invites];
  }
}
