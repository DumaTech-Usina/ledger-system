import { completenessOf, type PartyCompleteness } from "../../domain/services/PartyCompleteness";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";

/**
 * The parties still missing something worth knowing — the backlog that keeps enrichment out of the
 * conversation. A gap here costs nothing conversationally; it waits to be handled in bulk, or filled
 * by an import, which is a cheaper source of truth than asking a person.
 *
 * Computed on every call, never stored. A materialised "incomplete" flag would be a mutable status
 * that goes stale the instant an import fills the gap.
 */
export class ListIncompletePartiesUseCase {
  constructor(private readonly directory: PartyDirectoryPort) {}

  async execute(): Promise<PartyCompleteness[]> {
    const parties = await this.directory.list();
    return parties
      .filter((p) => p.identityState === PartyIdentityState.IDENTIFIED)
      .map(completenessOf)
      .filter((c) => c.missing.length > 0)
      .sort((a, b) => b.missing.length - a.missing.length || a.partyId.localeCompare(b.partyId));
  }
}
