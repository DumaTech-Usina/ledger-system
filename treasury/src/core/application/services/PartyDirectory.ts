import type { Party } from "../../domain/entities/Party";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { canonicalOf, readThroughLinks, identifiersOf as identifiersIn } from "../../domain/services/IdentityMapping";
import { resolveParty, type Resolution, type ResolutionQuery } from "../../domain/services/PartyResolution";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { IdentityLinkRepository } from "../repositories/IdentityLinkRepository";
import type { PartyRepository } from "../repositories/PartyRepository";

/**
 * The Party Directory: the stored parties, read through the identity mapping, plus the deterministic
 * cascade over them. It reads and resolves; it never creates.
 */
export class PartyDirectory implements PartyDirectoryPort {
  constructor(
    private readonly repo: PartyRepository,
    /** Omitted uses the cascade's conservative default. */
    private readonly threshold?: number,
    /** Omitted means nothing has been linked. */
    private readonly links?: IdentityLinkRepository,
  ) {}

  private async allLinks() {
    return this.links ? this.links.findAll() : [];
  }

  async resolve(query: ResolutionQuery): Promise<Resolution> {
    return resolveParty(query, await this.list(), this.threshold);
  }

  async get(partyId: string): Promise<Party | undefined> {
    const parties = await this.list();
    const found = parties.find((p) => p.partyId === partyId);
    if (found) return found;

    // An identifier written in the Ledger with no row of its own reads as the party it was linked to.
    const links = await this.allLinks();
    const target = parties.find((p) => p.partyId === canonicalOf(partyId, links));
    return target && target.partyId !== partyId
      ? { ...target, partyId, identityState: PartyIdentityState.MERGED, mergedInto: target.partyId }
      : undefined;
  }

  async list(): Promise<Party[]> {
    return readThroughLinks(await this.repo.findAll(), await this.allLinks());
  }

  async identifiersOf(partyId: string): Promise<string[]> {
    return identifiersIn(partyId, await this.allLinks());
  }
}
