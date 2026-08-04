import { env } from "../../config/env";
import { ImportPartiesUseCase } from "../../core/application/use-cases/ImportParties";
import { MeasureResolutionUseCase } from "../../core/application/use-cases/MeasureResolution";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { HttpLedgerReadAdapter } from "../ledger-read/HttpLedgerReadAdapter";
import { StubLedgerReadAdapter } from "../ledger-read/StubLedgerReadAdapter";
import { connectMongo, MongoPartyRepository } from "../persistence/MongoPartyRepository";
import { SystemClock } from "../system/SystemClock";
import { LedgerPartySweepSource } from "./LedgerPartySweepSource";

/**
 * Seeds the durable Party Directory from the Ledger, then reports how the cascade performs against
 * what was seeded. Runs outside the server and outside any conversation: it changes no behaviour,
 * it only gives the Directory something to resolve against.
 *
 * The measurement it prints is the figure that gates turning the resolution barrier on later.
 */
async function main(): Promise<void> {
  if (env.PARTY_DIRECTORY_MODE !== "mongo") {
    throw new Error(
      "Seeding a volatile directory would be pointless — set PARTY_DIRECTORY_MODE=mongo.",
    );
  }

  const ledger =
    env.LEDGER_MODE === "live"
      ? new HttpLedgerReadAdapter(env.LEDGER_API_URL)
      : new StubLedgerReadAdapter();

  const { db, close } = await connectMongo(env.MONGO_URL, env.MONGO_DB);
  try {
    const repo = new MongoPartyRepository(db);
    const directory = new PartyDirectory(repo);

    const imported = await new ImportPartiesUseCase(repo, new SystemClock()).execute(
      new LedgerPartySweepSource(ledger, env.USINA_PARTY_ID),
    );
    console.log("import:", imported);

    // Measured against the parties themselves: this reports what the book already contains, not how
    // real user phrasing will land. That number needs a corpus of real mentions.
    const mentions = (await directory.list()).map((p) => p.displayName);
    console.log("resolution:", await new MeasureResolutionUseCase(directory).execute(mentions));
  } finally {
    await close();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  // The two reachable failures are "no Ledger" and "no Mongo", and a bare "fetch failed" names
  // neither. Say which endpoint was being talked to.
  console.error(
    `Seeding failed: ${message}\n` +
      `  ledger: ${env.LEDGER_MODE === "live" ? env.LEDGER_API_URL : `${env.LEDGER_MODE} (stub data)`}\n` +
      `  mongo:  ${env.MONGO_DB} at ${env.MONGO_URL.replace(/\/\/[^@]*@/, "//***@")}`,
  );
  process.exit(1);
});
