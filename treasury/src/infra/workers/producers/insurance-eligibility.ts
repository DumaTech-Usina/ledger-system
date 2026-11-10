import { env } from "../../../config/env";
import { PublishInsuranceEligibilityUseCase } from "../../../core/application/use-cases/PublishInsuranceEligibility";
import { HttpInsuranceApiClient } from "../../insurance/HttpInsuranceApiClient";
import { eligibilityFieldsFrom } from "../../insurance/insuranceMapping";
import { RabbitMQPublisher } from "../../messaging/rabbitmq/RabbitMQPublisher";
import { SystemClock } from "../../system/SystemClock";

/**
 * `npm run worker:insurance` — reads the insurance system's eligible policies every
 * INSURANCE_POLL_MINUTES and publishes one message per policy (round 15). `--once` runs a single pass.
 *
 * Stateless: the same reading is published again on every pass, and the consumer recognises it.
 */
async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const publisher = new RabbitMQPublisher(env.RABBITMQ_URL);
  await publisher.connect();
  const pass = new PublishInsuranceEligibilityUseCase(
    new HttpInsuranceApiClient(env.INSURANCE_API_URL, env.INSURANCE_API_EMAIL, env.INSURANCE_API_PASSWORD),
    publisher,
    new SystemClock(),
    eligibilityFieldsFrom,
  );

  const run = async () => {
    try {
      const result = await pass.execute();
      console.log(`[insurance] published ${result.published}; skipped ${result.skipped.length}`);
      for (const s of result.skipped) console.warn(`[insurance] skipped ${s.policyId}: ${s.reason}`);
    } catch (err) {
      console.error("[insurance] pass failed:", err instanceof Error ? err.message : err);
    }
  };

  await run();
  if (once) {
    await publisher.close();
    return;
  }
  const timer = setInterval(() => void run(), env.INSURANCE_POLL_MINUTES * 60_000);
  const stop = async () => {
    clearInterval(timer);
    await publisher.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
