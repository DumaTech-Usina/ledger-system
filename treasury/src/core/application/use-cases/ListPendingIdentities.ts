import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import type { IdentityLinkRepository } from "../repositories/IdentityLinkRepository";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { PartyRepository } from "../repositories/PartyRepository";

export interface PendingIdentity {
  partyId: string;
  displayName: string;
  kind: "provisional" | "unidentifiable";
  createdAt?: string;
}

/**
 * What the persistent notification is about (REQ-321, REQ-302): identities named in a fact the Ledger
 * accepted, with no link yet. A conversation given up before sending, or a name mistyped in one, leaves
 * no fact behind and so nothing to chase; the same identity starts counting the moment a fact uses it.
 *
 * Computed on every read and never stored, so it cannot drift: linking is what clears it.
 */
export class ListPendingIdentitiesUseCase {
  constructor(
    private readonly parties: PartyRepository,
    private readonly links: IdentityLinkRepository,
    private readonly intents: IntentRepository,
  ) {}

  async execute(): Promise<PendingIdentity[]> {
    const linked = new Set((await this.links.findAll()).map((l) => l.fromIdentifier));
    const inFacts = new Set((await this.intents.listAccepted()).flatMap((intent) => Object.values(intent.answers)));

    return (await this.parties.findAll()).flatMap((party): PendingIdentity[] => {
      if (linked.has(party.partyId) || !inFacts.has(party.partyId)) return [];
      const kind =
        party.identityState === PartyIdentityState.PROVISIONAL
          ? "provisional"
          : party.identityState === PartyIdentityState.UNIDENTIFIABLE
            ? "unidentifiable"
            : null;
      return kind ? [{ partyId: party.partyId, displayName: party.displayName, kind, createdAt: party.createdAt }] : [];
    });
  }
}
