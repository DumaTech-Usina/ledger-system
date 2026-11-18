import type { ProposedFactKind } from "../entities/ExternalSignal";

/**
 * What every external system shares once its screen is read (§4.6, §4.7): a closed list of fields,
 * checked the same way whether a user typed them or an integration brought them (REQ-278, REQ-281),
 * and one proposal per happening the signal reports (REQ-261).
 */

export type FieldFormat = "text" | "money" | "date" | "percent" | "count";

export interface FieldSpec {
  key: string;
  format: FieldFormat;
  required: boolean;
}

const FORMAT: Record<FieldFormat, RegExp> = {
  text: /\S/,
  money: /^\d+(\.\d{1,2})?$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  percent: /^\d+(\.\d+)?$/,
  count: /^\d+$/,
};

const FORMAT_HINT: Record<FieldFormat, string> = {
  text: "não pode ficar em branco",
  money: "deve ser um valor como 77.26",
  date: "deve ser uma data como 2026-10-21",
  percent: "deve ser um número como 60",
  count: "deve ser um número inteiro como 3",
};

/**
 * The fields worth keeping, trimmed and without blanks, or the list of what is wrong. An unknown
 * field is an error, never silently dropped: the user should know it was not kept.
 */
export function validateFields(
  specs: readonly FieldSpec[],
  raw: Record<string, unknown>,
): { fields: Record<string, string>; errors: string[] } {
  const errors: string[] = [];
  const fields: Record<string, string> = {};

  for (const key of Object.keys(raw)) {
    if (!specs.some((s) => s.key === key)) errors.push(`${key}: não é guardado no sinal`);
  }
  for (const spec of specs) {
    const value = raw[spec.key];
    const text = typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
    if (text === "") {
      if (spec.required) errors.push(`${spec.key}: obrigatório`);
      continue;
    }
    if (!FORMAT[spec.format].test(text)) {
      errors.push(`${spec.key}: ${FORMAT_HINT[spec.format]}`);
      continue;
    }
    fields[spec.key] = text;
  }
  return { fields, errors };
}

/** A context the fact cites with `references` (REQ-267, REQ-283): never a balance. */
export interface ContextCitation {
  objectId: string;
  objectType: "contract" | "proposal" | "installment";
}

export interface FactProposal {
  fact: ProposedFactKind;
  scenarioId: string;
  sourceReference: string;
  answers: { key: string; value: string }[];
  /** What the fact is about: the policy, or the proposal and its installment. */
  contexts: ContextCitation[];
  /** Whose party the fact needs, by the source's id, and which answer it fills. */
  party?: { slot: string; registry: string; externalId?: string; seenAs?: string; label: string };
  /** REQ-286: a zero from the source. The amount is left for the user; the hint travels with it. */
  suggestion?: "no_obligation";
}

/** A money figure from the source that is exactly zero. */
export const isZeroAmount = (value: string | undefined): boolean => value !== undefined && /^0+(\.0+)?$/.test(value);

export const toBrDate = (iso: string): string => iso.split("-").reverse().join("/");
