import { localDay } from "../../core/application/utils/instant";

/**
 * The insurance API's shapes → the signal's fields (round 15). The only place that knows the
 * insurance system's field names. Checked against the real API on 2026-11-09:
 *
 *   GET /payouts/eligible     → policyId, policyNumber, broker, netPremium, workedCommission (CT),
 *                               payoutRate (CR), ctu, usinaValue, payout, retained, eligibleAt, signedBy
 *   GET /policies/:id         → brokerId, proposalId, registeredAt (the policy date, REQ-272)
 *   GET /proposals/:id        → insurerId, productId
 *
 * The client (name, id, document) is never read into a field (REQ-267). Percentages already come as
 * percent ("20"); dates are turned into the day in São Paulo (REQ-225). A missing value is left out,
 * never filled with a default: the signal's own validation then says what is missing.
 */
export function eligibilityFieldsFrom(
  eligible: Record<string, unknown>,
  policy: Record<string, unknown>,
  proposal: Record<string, unknown>,
): Record<string, string> {
  const fields: Record<string, string> = {};
  const put = (key: string, value: unknown, transform: (v: string) => string = (v) => v) => {
    if (typeof value === "string" && value.trim() !== "") fields[key] = transform(value.trim());
    else if (typeof value === "number") fields[key] = transform(String(value));
  };

  put("policyId", eligible.policyId);
  put("policyNumber", eligible.policyNumber);
  // The insurer's name is not published by the API; its id is what the screen shows.
  put("insurer", proposal.insurerId);
  put("insurerId", proposal.insurerId);
  put("broker", eligible.broker);
  put("brokerId", policy.brokerId);
  put("product", proposal.productId);
  put("netPremium", eligible.netPremium);
  put("ct", eligible.workedCommission);
  put("ctu", eligible.ctu);
  put("cr", eligible.payoutRate);
  put("usinaValue", eligible.usinaValue);
  put("payout", eligible.payout);
  put("retained", eligible.retained);
  put("eligibleAt", eligible.eligibleAt, localDay);
  put("policyDate", policy.registeredAt, localDay);
  put("signedBy", eligible.signedBy);
  return fields;
}
