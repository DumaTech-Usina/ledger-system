import type { Party } from "../../core/domain/entities/Party";
import type { PartyRepository } from "../../core/application/repositories/PartyRepository";

/** MVP persistence. Stores a copy per write and hands out copies, so no caller can mutate the store. */
export class InMemoryPartyRepository implements PartyRepository {
  private readonly store = new Map<string, Party>();

  async save(party: Party): Promise<void> {
    this.store.set(party.partyId, clone(party));
  }

  async findById(partyId: string): Promise<Party | null> {
    const found = this.store.get(partyId);
    return found ? clone(found) : null;
  }

  async findAll(): Promise<Party[]> {
    return [...this.store.values()].map(clone);
  }
}

function clone(party: Party): Party {
  return {
    ...party,
    aliases: [...party.aliases],
    externalIds: party.externalIds.map((e) => ({ ...e })),
    attributes: Object.fromEntries(
      Object.entries(party.attributes).map(([key, attribute]) => [key, { ...attribute }]),
    ),
  };
}
