import { amountFromDigits } from "@/utils/money";
import type { ProposedFactKind, SignalKind } from "./signalsApi";

/**
 * The fields the user copies from the insurance system's screen (§4.6, REQ-261), in the order the
 * screen shows them. Mirrors the server's list; the server stays the authority and refuses anything
 * else, so a field missing here is simply not offered, never sent unchecked.
 */
export type FieldFormat = "text" | "money" | "date" | "percent";

export interface SignalField {
  key: string;
  format: FieldFormat;
  required: boolean;
}

const BASE: SignalField[] = [
  { key: "policyId", format: "text", required: true },
  { key: "policyNumber", format: "text", required: false },
  { key: "insurer", format: "text", required: false },
  { key: "insurerId", format: "text", required: false },
  { key: "broker", format: "text", required: false },
  { key: "brokerId", format: "text", required: false },
  { key: "product", format: "text", required: false },
  { key: "netPremium", format: "money", required: false },
  { key: "ct", format: "percent", required: false },
  { key: "ctu", format: "percent", required: false },
  { key: "usinaValue", format: "money", required: true },
];

export const SIGNAL_FORM: Record<SignalKind, SignalField[]> = {
  policy: [...BASE, { key: "registeredAt", format: "date", required: true }, { key: "expectedAt", format: "date", required: false }],
  eligibility: [
    ...BASE,
    { key: "cr", format: "percent", required: false },
    { key: "payout", format: "money", required: true },
    { key: "retained", format: "money", required: false },
    { key: "eligibleAt", format: "date", required: true },
    { key: "policyDate", format: "date", required: false },
    { key: "signedBy", format: "text", required: false },
  ],
};

/**
 * What leaves the form: blanks dropped, money from its typed digits to the Ledger's form (REQ-228),
 * a percentage with a comma read as a decimal point. Money fields hold digits, not text.
 */
export function signalPayload(kind: SignalKind, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of SIGNAL_FORM[kind]) {
    const raw = (values[field.key] ?? "").trim();
    if (raw === "") continue;
    if (field.format === "money") out[field.key] = amountFromDigits(raw);
    else if (field.format === "percent") out[field.key] = raw.replace(",", ".");
    else out[field.key] = raw;
  }
  return out;
}

export const missingRequired = (kind: SignalKind, values: Record<string, string>): string[] =>
  SIGNAL_FORM[kind].filter((f) => f.required && (values[f.key] ?? "").trim() === "").map((f) => f.key);

/** The conversation each proposed fact continues in. */
export const SCENARIO_OF: Record<ProposedFactKind, string> = {
  commission_expected: "register_commission_accrual",
  commission_obligation: "register_obligation_recognition",
};

/** A proposal still waiting for the user; accepted and terminally refused ones are not reopened. */
export const isOpenProposal = (status: string | null): boolean =>
  status === "gathering" || status === "awaiting_confirmation" || status === "awaiting_correction";
