import { validateSignalFields } from "../../domain/services/InsuranceSignal";
import { SIGNAL_ROUTE, buildEligibilityMessage } from "../messaging/insuranceSignalMessage";
import type { Clock } from "../ports/Clock";
import type { InsuranceSourcePort } from "../ports/InsuranceSourcePort";
import type { MessagePublisherPort } from "../ports/MessagePublisherPort";

/** Turns the insurance API's records into a signal's fields. Lives in infra; only its shape is known here. */
export type ToSignalFields = (
  eligible: Record<string, unknown>,
  policy: Record<string, unknown>,
  proposal: Record<string, unknown>,
) => Record<string, string>;

export interface PublishResult {
  published: number;
  /** Eligible policies that did not make a valid signal: reported, never published half-built. */
  skipped: { policyId: string; reason: string }[];
}

/**
 * One pass of the producer (round 15): every eligible policy becomes one message. Stateless — it does
 * not remember what it sent; the consumer recognises a reading it already has (same fingerprint).
 */
export class PublishInsuranceEligibilityUseCase {
  constructor(
    private readonly source: InsuranceSourcePort,
    private readonly publisher: MessagePublisherPort,
    private readonly clock: Clock,
    private readonly toFields: ToSignalFields,
  ) {}

  async execute(): Promise<PublishResult> {
    const result: PublishResult = { published: 0, skipped: [] };
    for (let page = 1; ; page++) {
      const { items } = await this.source.eligible(page);
      if (items.length === 0) break;
      for (const item of items) {
        const policyId = String(item.policyId ?? "");
        try {
          const policy = await this.source.policy(policyId);
          const proposal = typeof policy.proposalId === "string" ? await this.source.proposal(policy.proposalId) : {};
          const fields = this.toFields(item, policy, proposal);
          const { errors } = validateSignalFields("eligibility", fields);
          if (errors.length > 0) {
            result.skipped.push({ policyId, reason: errors.join("; ") });
            continue;
          }
          await this.publisher.publish(SIGNAL_ROUTE.routingKey, buildEligibilityMessage(fields, this.clock.now()));
          result.published += 1;
        } catch (err) {
          result.skipped.push({ policyId, reason: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    return result;
  }
}
