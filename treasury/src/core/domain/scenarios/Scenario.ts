import { SlotDefinition } from "../value-objects/Slot";
import { registerPayment } from "./registerPayment";
import { registerPayroll } from "./registerPayroll";
import { registerInfrastructure } from "./registerInfrastructure";
import { registerPenalty } from "./registerPenalty";
import { registerIncentive } from "./registerIncentive";
import { registerAdvance } from "./registerAdvance";
import { registerLoan } from "./registerLoan";

/**
 * A business intention, defined declaratively as an ordered set of slots. Adding a scenario
 * is data-only — no new plumbing — mirroring the Ledger's data-driven design philosophy.
 * The economic mapping to a Ledger candidate is applied later by CandidateMapper; the
 * Ledger pipeline remains the sole authority that validates and commits it.
 */
export interface Scenario {
  id: string;
  title: string;
  description: string;
  slots: SlotDefinition[];
}

const REGISTRY: Record<string, Scenario> = {
  [registerPayment.id]: registerPayment,
  [registerPayroll.id]: registerPayroll,
  [registerInfrastructure.id]: registerInfrastructure,
  [registerPenalty.id]: registerPenalty,
  [registerIncentive.id]: registerIncentive,
  [registerAdvance.id]: registerAdvance,
  [registerLoan.id]: registerLoan,
};

export function getScenario(id: string): Scenario | undefined {
  return REGISTRY[id];
}

export function listScenarios(): Scenario[] {
  return Object.values(REGISTRY);
}
