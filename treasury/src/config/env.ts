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
   * How treasury extracts slot values from natural language:
   *  - "stub": deterministic regex/keyword extractor (no external model). The default until the
   *            conversational workflow is complete.
   * A real-model adapter will be added as a new value here, selected without any change to core.
   */
  EXTRACTION_MODE: z.enum(["stub"]).default("stub"),

  /** The usina's party id, used when mapping an intent to a Ledger candidate. */
  USINA_PARTY_ID: z.string().default("party-usina"),

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
