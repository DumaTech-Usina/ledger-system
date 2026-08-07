import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  /** Read-only Ledger API base URL — used to display financial effects; never for writes. */
  LEDGER_API_URL: z.string().default("http://localhost:3000"),

  /**
   * How treasury talks to the Ledger:
   *  - "simulate": one in-memory fake Ledger for BOTH submit + reads → the full create→dashboard
   *                loop works end-to-end without a real Ledger (demo).
   *  - "stub":     stubbed submit + static stub dashboard data (disconnected mock).
   *  - "live":     real Ledger over HTTP for BOTH submit and reads (LEDGER_API_URL).
   */
  LEDGER_MODE: z.enum(["simulate", "stub", "live"]).default("simulate"),

  /** Service token sent as a Bearer credential on live submissions to the Ledger. */
  LEDGER_SUBMIT_TOKEN: z.string().default(""),

  /**
   * The Ledger's exported economic algebra (`npm run export:algebra` in the ledger package).
   *
   * A build artifact, not a source of truth: treasury derives what may touch a position from it
   * rather than restating the Ledger's rules. Refusing to boot without it is deliberate — the
   * alternative is an interface that silently offers nothing and looks like it is working.
   */
  LEDGER_ALGEBRA_PATH: z.string().default("../ledger/algebra.json"),

  /**
   * How often the navigation snapshot walks what the Ledger recorded since it last looked.
   *
   * 60 minutes is deliberate and the cost is understood: treasury's own writes invalidate
   * immediately, so what waits up to an hour is what OTHER producers wrote — the staging pipeline
   * and the workers. That is tolerable only because the snapshot never answers anything: the
   * positions listing still comes from the Ledger, so a position created by normalization is
   * visible at once regardless of what the cache remembers.
   */
  SNAPSHOT_REFRESH_MINUTES: z.coerce.number().int().positive().default(60),

  /**
   * How treasury extracts slot values from natural language:
   *  - "stub": deterministic regex/keyword extractor (no external model). The default until the
   *            conversational workflow is complete.
   * A real-model adapter will be added as a new value here, selected without any change to core.
   */
  EXTRACTION_MODE: z.enum(["stub"]).default("stub"),

  /** The usina's party id, used when mapping an intent to a Ledger candidate. */
  USINA_PARTY_ID: z.string().default("party-usina"),

  /**
   * Where the Party Directory lives:
   *  - "memory": volatile. Fine for tests and for exercising resolution, never for issuing ids.
   *  - "mongo":  durable, at MONGO_URL. Required before any PartyId reaches a production Ledger —
   *              an id lost on restart would be orphaned inside an immutable event.
   */
  PARTY_DIRECTORY_MODE: z.enum(["memory", "mongo"]).default("memory"),

  /** MongoDB connection string for the Party Directory. */
  MONGO_URL: z.string().default("mongodb://root:rootpassword@localhost:27017"),

  /** Database holding the Party Directory collection. */
  MONGO_DB: z.string().default("treasury"),

  /** Session lifetime in hours. */
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),

  /** Seed credentials (dev defaults only — set real values in production). */
  AUTH_MANAGER_PASSWORD: z.string().default("treasury"),
  AUTH_VIEWER_PASSWORD: z.string().default("viewer"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const lines = result.error.issues
    .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${lines}`);
}

export const env = result.data;
export type Env = typeof env;
