import "dotenv/config";
import { z } from "zod";

const boolFromString = z
  .string()
  .transform((v) => v === "true")
  .default(false);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  SERVER_PORT: z.coerce.number().int().positive().default(3000),

  /**
   * The timezone the book is kept in. Defaults to the usina's own rather than to the host's.
   *
   * This does NOT change how instants are stored — those are UTC, always. It decides how a time
   * WITHOUT an offset is read: `"2026-09-14T10:00:00"` means ten in the morning somewhere, and
   * without this the answer would be "wherever the container happens to run", which is UTC on
   * every stock Linux image. The same submission would then land three hours off, and a movement
   * recorded late in the evening would be filed on the following day.
   *
   * Overridable, because the timezone a book is kept in is a property of the business, not of this
   * code — a second usina elsewhere sets its own.
   */
  TZ: z.string().min(1).default("America/Sao_Paulo"),

  /**
   * The book's file. One SQLite database holds everything the service records: the confirmed
   * events, the staging records awaiting promotion and the rejected ones. A single file is what
   * makes a backup a copy and a restore a paste — and what removes the database server from the
   * host's requirements entirely.
   *
   * The default is relative to the working directory, which is fine for a dev run. Under Docker it
   * is an absolute path inside the mounted volume, so the book outlives the container.
   */
  DB_FILE: z.string().min(1).default("./data/ledger.db"),

  DB_LOGGING: boolFromString,
  DB_MIGRATIONS_RUN: boolFromString,

  /**
   * The EXTERNAL Mongo the ETL readers harvest from (the normalizer's own store) — never where this
   * service records anything. Optional: the server never opens it, only the `ingest:*` scripts do,
   * and they fail loudly when it is missing rather than making the API refuse to boot without it.
   */
  MONGODB_URI: z.string().default(""),
  MONGO_ETL_DB: z.string().default("rules_engine_v3"),

  RABBITMQ_URL: z.string().default("amqp://guest:guest@localhost:5672"),

  AUDIT_LOG_DIR: z.string().default("./logs/audit"),

  USINA_PARTY_ID: z.string().default("party-usina"),

  /** Service token required on the User App submit endpoint. Empty = endpoint fails closed. */
  LEDGER_SUBMIT_TOKEN: z.string().default(""),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const lines = result.error.issues
    .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${lines}`);
}

export const env = result.data;

/**
 * Applied to the process before anything reads a clock or parses a date.
 *
 * This module is the first thing every entrypoint pulls in — the data source, the server and each
 * worker import it before constructing anything — so the zone is in place ahead of the first
 * `new Date`. Node re-reads `process.env.TZ` on the next date operation, so assigning it here is
 * enough and no wrapper script is needed to set it from outside.
 */
process.env.TZ = env.TZ;

export type Env = typeof env;
