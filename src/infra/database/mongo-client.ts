import 'reflect-metadata';
import { Db, MongoClient } from 'mongodb';
import { env } from '../../config/env';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Returns a connected Db instance, creating the connection on first call.
 * Subsequent calls return the cached instance.
 */
export async function getMongoDb(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  db = client.db();

  return db;
}

export async function closeMongoDb(): Promise<void> {
  if (!client) return;
  await client.close();
  client = null;
  db = null;
}
