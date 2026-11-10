import { z } from "zod";
import { signalFingerprint } from "../services/signalFingerprint";

/**
 * The one contract between the insurance producer and the signal consumer (round 15). Both sides
 * import this file: the producer builds with `buildEligibilityMessage`, the consumer accepts with
 * `parseSignalMessage`, so they cannot drift apart.
 *
 * Only the envelope is checked here. The fields are checked by the signal itself
 * (`validateSignalFields`), the same rule the form obeys — one rule, whatever the way in.
 */

/** Where the message travels. Mirrors the Ledger's own RabbitMQ layout (direct exchange + DLQ). */
export const SIGNAL_ROUTE = {
  exchange: "treasury",
  routingKey: "signal.insurance",
  queue: "treasury.signals",
  deadLetterExchange: "treasury.dlx",
  deadLetterQueue: "treasury.signals.dead",
} as const;

export const SIGNAL_MESSAGE_TYPE = "insurance.signal.observed";
export const SIGNAL_MESSAGE_VERSION = 1;
export const SIGNAL_SOURCE = "seguro";

const schema = z.object({
  messageId: z.string().min(1),
  type: z.literal(SIGNAL_MESSAGE_TYPE),
  version: z.literal(SIGNAL_MESSAGE_VERSION),
  source: z.literal(SIGNAL_SOURCE),
  publisher: z.string().min(1),
  observedAt: z.string().datetime(),
  signal: z.object({
    // Only the eligibility is published, by decision of 2026-11-09.
    kind: z.literal("eligibility"),
    fields: z.record(z.string(), z.string()),
  }),
});

export type SignalMessage = z.infer<typeof schema>;

/**
 * The message for one eligible policy. Its id is the reading itself — system, kind, policy and the
 * fingerprint of the fields — so publishing the same reading twice gives the same id.
 */
export function buildEligibilityMessage(fields: Record<string, string>, observedAt: string): SignalMessage {
  return {
    messageId: `${SIGNAL_SOURCE}:eligibility:${fields.policyId}:${signalFingerprint("eligibility", fields)}`,
    type: SIGNAL_MESSAGE_TYPE,
    version: SIGNAL_MESSAGE_VERSION,
    source: SIGNAL_SOURCE,
    publisher: "treasury-insurance-producer",
    observedAt,
    signal: { kind: "eligibility", fields },
  };
}

export function parseSignalMessage(raw: string): { ok: true; message: SignalMessage } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "not JSON" };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { ok: true, message: parsed.data }
    : { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join(".") || "message"}: ${i.message}`).join("; ") };
}
