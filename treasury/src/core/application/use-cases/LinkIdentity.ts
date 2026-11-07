import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { canonicalOf } from "../../domain/services/IdentityMapping";
import type { IdentityLink } from "../../domain/value-objects/IdentityLink";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import type { IdentityLinkRepository } from "../repositories/IdentityLinkRepository";
import type { PartyRepository } from "../repositories/PartyRepository";

export interface LinkIdentityInput {
  /** A provisional or unidentifiable PartyId, or an identifier already written in the Ledger. */
  identifier: string;
  partyId: string;
  userId: string;
}

/** A refusal the curator can act on. Not a fault. */
export class IdentityLinkError extends Error {}

/**
 * Says that an identifier is a registered party: this is how a provisional identity is resolved
 * (REQ-322) and how the past gets mapped without being corrected (REQ-332). Only someone with curation
 * may do it (enforced at the route). It writes one row in the Treasury and sends nothing to the Ledger.
 *
 * An identifier takes one link. Replacing it would be rewriting (REQ-331), and how to undo a wrong one
 * is still DEC-015, so for now the second attempt is refused.
 */
export class LinkIdentityUseCase {
  constructor(
    private readonly parties: PartyRepository,
    private readonly links: IdentityLinkRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: LinkIdentityInput): Promise<IdentityLink> {
    const identifier = (input.identifier ?? "").trim();
    if (identifier === "") throw new IdentityLinkError("Say which identifier to link.");
    if (identifier === input.partyId) throw new IdentityLinkError("An identifier cannot be linked to itself.");

    const target = await this.parties.findById(input.partyId);
    if (!target || target.identityState !== PartyIdentityState.IDENTIFIED) {
      throw new IdentityLinkError("An identifier can only be linked to a registered party.");
    }

    const links = await this.links.findAll();
    if (links.some((l) => l.fromIdentifier === identifier)) {
      throw new IdentityLinkError("This identifier is already linked.");
    }
    if (canonicalOf(input.partyId, links) !== input.partyId) {
      throw new IdentityLinkError("That party is itself linked to another one; link to that one instead.");
    }

    const link: IdentityLink = {
      id: this.ids.next(),
      fromIdentifier: identifier,
      toPartyId: input.partyId,
      linkedBy: input.userId,
      linkedAt: this.clock.now(),
    };
    await this.links.append(link);
    return link;
  }
}
