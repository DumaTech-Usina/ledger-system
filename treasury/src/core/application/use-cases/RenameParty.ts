import type { PartyRepository } from "../repositories/PartyRepository";

export interface RenamePartyInput {
  partyId: string;
  displayName: string;
}

export interface RenamePartyResult {
  partyId: string;
  displayName: string;
}

/**
 * Corrects a counterparty's display name — a typo, a legal-name change, a name entered wrong during
 * an early conversation. Goes through the plain `PartyRepository`, not `PartyDirectoryPort`: the
 * Directory's read-only port is deliberately scoped to RESOLUTION (deciding who a mention is), and
 * renaming an already-identified party is a distinct act — the same seam `RecordPartyAttributeUseCase`
 * already uses for the Directory's other write path.
 *
 * The PartyId never moves and no past event is touched — renaming never fragments history.
 */
export class RenamePartyUseCase {
  constructor(private readonly repo: PartyRepository) {}

  async execute(input: RenamePartyInput): Promise<RenamePartyResult> {
    const trimmed = input.displayName.trim();
    if (trimmed === "") throw new Error("O nome não pode ficar em branco.");

    const party = await this.repo.findById(input.partyId);
    if (!party) throw new Error(`Unknown party: ${input.partyId}`);

    await this.repo.save({ ...party, displayName: trimmed });
    return { partyId: party.partyId, displayName: trimmed };
  }
}
