import { MongoClient, type Collection, type Db } from "mongodb";
import type { Party } from "../../core/domain/entities/Party";
import type { PartyRepository } from "../../core/application/repositories/PartyRepository";

/**
 * The durable Party Directory. A party is stored as one document — aliases, external ids and
 * attributes nest exactly as the aggregate holds them, so nothing is normalized away and nothing is
 * reassembled on read.
 *
 * `_id` is the PartyId. That makes the id the primary key of the store, which is the property that
 * matters: an id that has reached an immutable event can never be lost or silently duplicated here.
 */
export class MongoPartyRepository implements PartyRepository {
  private readonly collection: Collection<PartyDocument>;

  constructor(db: Db, collectionName = "parties") {
    this.collection = db.collection<PartyDocument>(collectionName);
  }

  async save(party: Party): Promise<void> {
    // The replacement carries no `_id` — the filter supplies it, and on upsert Mongo takes it from
    // there. That is what makes save idempotent on the PartyId rather than insert-only.
    const { partyId, ...rest } = party;
    await this.collection.replaceOne({ _id: partyId }, rest, { upsert: true });
  }

  async findById(partyId: string): Promise<Party | null> {
    const found = await this.collection.findOne({ _id: partyId });
    return found ? toParty(found) : null;
  }

  async findAll(): Promise<Party[]> {
    // Sorted by id so the cascade sees a stable order regardless of insertion history.
    const found = await this.collection.find({}).sort({ _id: 1 }).toArray();
    return found.map(toParty);
  }
}

/** The stored shape: the aggregate with `partyId` carried by `_id`. */
type PartyDocument = Omit<Party, "partyId"> & { _id: string };

function toParty(document: PartyDocument): Party {
  const { _id, ...rest } = document;
  return {
    partyId: _id,
    ...rest,
    aliases: [...rest.aliases],
    externalIds: rest.externalIds.map((e) => ({ ...e })),
    attributes: { ...rest.attributes },
  };
}

/**
 * Opens a connection and hands back the database plus its closer. Kept separate from the repository
 * so the repository owns no lifecycle — the composition root does.
 */
export async function connectMongo(
  url: string,
  dbName: string,
): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  return { db: client.db(dbName), close: () => client.close() };
}
