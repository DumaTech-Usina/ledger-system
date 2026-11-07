import type { IdentityLink } from "../../core/domain/value-objects/IdentityLink";
import type { IdentityLinkRepository } from "../../core/application/repositories/IdentityLinkRepository";

export class InMemoryIdentityLinkRepository implements IdentityLinkRepository {
  private readonly links: IdentityLink[] = [];

  async append(link: IdentityLink): Promise<void> {
    this.links.push({ ...link });
  }

  async findAll(): Promise<IdentityLink[]> {
    return this.links.map((link) => ({ ...link }));
  }
}
