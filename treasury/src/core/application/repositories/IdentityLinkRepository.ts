import type { IdentityLink } from "../../domain/value-objects/IdentityLink";

/** Only of addition (REQ-331): this boundary has no way to change or remove a link. */
export interface IdentityLinkRepository {
  append(link: IdentityLink): Promise<void>;
  findAll(): Promise<IdentityLink[]>;
}
