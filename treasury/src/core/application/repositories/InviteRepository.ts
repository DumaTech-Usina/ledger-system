import type { Invite } from "../../domain/entities/Invite";

export interface InviteRepository {
  save(invite: Invite): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Invite | null>;
  /** Every invite still "pending", expired or not; the caller reads expiry from its clock. */
  listPending(): Promise<Invite[]>;
}
