import { env } from "../../../config/env";
import { resolveStore } from "../../../config/operationsStore";
import { PartyDirectory } from "../../../core/application/services/PartyDirectory";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { ReceiveSignalMessageUseCase } from "../../../core/application/use-cases/ReceiveSignalMessage";
import { RegisterExternalSignalUseCase } from "../../../core/application/use-cases/RegisterExternalSignal";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { SqliteConversationLog } from "../../audit/SqliteConversationLog";
import { RabbitMQSignalConsumer } from "../../messaging/rabbitmq/RabbitMQSignalConsumer";
import { SqliteExternalSignalRepository } from "../../persistence/SqliteExternalSignalRepository";
import { SqliteIdentityLinkRepository } from "../../persistence/SqliteIdentityLinkRepository";
import { SqliteIntentRepository } from "../../persistence/SqliteIntentRepository";
import { SqlitePartyRepository } from "../../persistence/SqlitePartyRepository";
import { SystemClock } from "../../system/SystemClock";
import { UuidGenerator } from "../../system/UuidGenerator";

/**
 * `npm run consume:signals` — registers the insurance system's signals as they arrive (round 15).
 *
 * A separate process from the web server, sharing its SQLite files: what it records is what the
 * screen reads. In memory it would record into a store nobody else sees, so it refuses to start.
 */
function main(): void {
  const operations = resolveStore(env.LEDGER_MODE, "OPERATIONS_STORE_MODE", env.OPERATIONS_STORE_MODE);
  const parties = resolveStore(env.LEDGER_MODE, "PARTY_DIRECTORY_MODE", env.PARTY_DIRECTORY_MODE);
  if (operations !== "sqlite" || parties !== "sqlite") {
    throw new Error(
      "The signal consumer needs the SQLite stores the web server uses (OPERATIONS_STORE_MODE and " +
        "PARTY_DIRECTORY_MODE = sqlite, or LEDGER_MODE=live).",
    );
  }

  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const intents = new SqliteIntentRepository(env.OPERATIONS_DB_FILE);
  const signals = new SqliteExternalSignalRepository(env.OPERATIONS_DB_FILE);
  const log = new SqliteConversationLog(env.OPERATIONS_DB_FILE);
  const partyRepo = new SqlitePartyRepository(env.PARTY_DB_FILE);
  const directory = new PartyDirectory(partyRepo, undefined, new SqliteIdentityLinkRepository(env.PARTY_DB_FILE));
  const applyAnswers = new ApplyAnswersUseCase(intents, clock, log, directory);
  const register = new RegisterExternalSignalUseCase(
    signals,
    intents,
    new StartIntentUseCase(intents, clock, ids, log),
    applyAnswers,
    directory,
    partyRepo,
    clock,
    ids,
  );

  const consumer = new RabbitMQSignalConsumer(env.RABBITMQ_URL, new ReceiveSignalMessageUseCase(register));
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  void consumer.start();
}

main();
