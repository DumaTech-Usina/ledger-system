import type { SignalKind, SignalSystem } from "../entities/ExternalSignal";
import { INSURANCE_SYSTEM, isInsuranceSignalKind, proposalsFor, validateSignalFields } from "./InsuranceSignal";
import { HEALTH_SYSTEM, healthProposalsFor, installmentRecordId, validateHealthFields } from "./HealthSignal";
import type { FactProposal } from "./SignalProposal";

/**
 * Which external system each kind of reading comes from, and how it is read. Adding a system is adding
 * an entry here and its own mapping file; the signal, the proposals, the review and the submit stay the
 * same for all of them (REQ-281).
 */
export interface SignalSource {
  system: SignalSystem;
  /** The system's name in references and in the integration's authorship (`system:<name>`). */
  name: string;
  validate(raw: Record<string, unknown>): { fields: Record<string, string>; errors: string[] };
  /** The record's id in the source: what successive readings of the same thing share. */
  recordId(fields: Record<string, string>): string;
  proposals(fields: Record<string, string>): FactProposal[];
}

export const isSignalKind = (value: unknown): value is SignalKind => isInsuranceSignalKind(value) || value === "installment";

export function signalSourceOf(kind: SignalKind): SignalSource {
  if (kind === "installment") {
    return {
      system: "health",
      name: HEALTH_SYSTEM,
      validate: validateHealthFields,
      recordId: installmentRecordId,
      proposals: healthProposalsFor,
    };
  }
  return {
    system: "insurance",
    name: INSURANCE_SYSTEM,
    validate: (raw) => validateSignalFields(kind, raw),
    recordId: (fields) => fields.policyId,
    proposals: (fields) => proposalsFor(kind, fields),
  };
}

export const isSignalSystem = (value: unknown): value is SignalSystem => value === "insurance" || value === "health";
