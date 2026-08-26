import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { AttributeState } from "../../domain/enums/AttributeState";
import { PartyAttributeKey } from "../../domain/value-objects/PartyAttribute";

export interface PartySummary {
  partyId: string;
  displayName: string;
  document?: string;
}

/**
 * Every registered counterparty the Directory knows, for the Contrapartes screen's table. Excludes
 * the usina's own party record — seeded into the Directory so cash movements can join against it
 * (see `LedgerPartySweepSource`), but it is who "we" are, never a counterparty to list — and a party
 * MERGED into another, since it answers for its survivor and would otherwise show as a second, dead
 * row for the same entity.
 */
export class ListPartiesUseCase {
  constructor(
    private readonly directory: PartyDirectoryPort,
    private readonly usinaPartyId: string,
  ) {}

  async execute(): Promise<{ parties: PartySummary[] }> {
    const parties = await this.directory.list();
    return {
      parties: parties
        .filter((p) => p.partyId !== this.usinaPartyId && p.identityState !== PartyIdentityState.MERGED)
        .map((p) => ({
          partyId: p.partyId,
          displayName: p.displayName,
          document:
            p.attributes[PartyAttributeKey.DOCUMENT]?.state === AttributeState.KNOWN
              ? p.attributes[PartyAttributeKey.DOCUMENT]?.value
              : undefined,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  }
}
