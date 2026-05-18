import 'reflect-metadata';
import { Db, MongoClient } from 'mongodb';
import { env } from '../../config/env';

let client: MongoClient | null = null;
let db: Db | null = null;

async function ensureClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();
  }
  return client;
}

/**
 * Returns a connected Db instance (database from the URI), creating the
 * connection on first call. Subsequent calls return the cached instance.
 */
export async function getMongoDb(): Promise<Db> {
  if (db) return db;
  const c = await ensureClient();
  db = c.db();
  return db;
}

/**
 * Returns a Db for a specific database name, reusing the shared MongoClient.
 * Use this to access databases other than the one in MONGODB_URI.
 */
export async function getMongoDatabase(name: string): Promise<Db> {
  const c = await ensureClient();
  return c.db(name);
}

export async function closeMongoDb(): Promise<void> {
  if (!client) return;
  await client.close();
  client = null;
  db = null;
}
