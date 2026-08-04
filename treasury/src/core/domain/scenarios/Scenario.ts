import { SlotDefinition } from "../value-objects/Slot";
import { registerPayment } from "./registerPayment";
import { registerPayroll } from "./registerPayroll";
import { registerInfrastructure } from "./registerInfrastructure";
import { registerPenalty } from "./registerPenalty";
import { registerIncentive } from "./registerIncentive";
import { registerAdvance } from "./registerAdvance";
import { registerLoan } from "./registerLoan";
import { registerWaiver } from "./registerWaiver";
import { registerCommissionAccrual } from "./registerCommissionAccrual";
import { registerDirectPayment } from "./registerDirectPayment";
import { registerCommissionReceived } from "./registerCommissionReceived";
import { registerAdvanceSettlement } from "./registerAdvanceSettlement";
import { registerRectification } from "./registerRectification";
import { registerLoanRepayment } from "./registerLoanRepayment";

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
  /**
   * Locale-keyed classification keywords, co-located with the scenario. They are the deterministic
   * classifier's per-language signal: an utterance is matched against the union of all locales'
   * keywords, so the same keyword-scoring algorithm recognizes the intent in any provided language.
   * Adding a language is adding a key here — no parallel dictionaries, no code changes. Keep the
   * words DISTINCTIVE (each should belong to a single scenario) since the classifier scores only
   * tokens unique to one scenario.
   */
  keywords?: Record<string, string[]>;
}

const REGISTRY: Record<string, Scenario> = {
  [registerPayment.id]: registerPayment,
  [registerPayroll.id]: registerPayroll,
  [registerInfrastructure.id]: registerInfrastructure,
  [registerPenalty.id]: registerPenalty,
  [registerIncentive.id]: registerIncentive,
  [registerAdvance.id]: registerAdvance,
  [registerLoan.id]: registerLoan,
  [registerWaiver.id]: registerWaiver,
  [registerCommissionAccrual.id]: registerCommissionAccrual,
  [registerDirectPayment.id]: registerDirectPayment,
  [registerCommissionReceived.id]: registerCommissionReceived,
  [registerAdvanceSettlement.id]: registerAdvanceSettlement,
  [registerRectification.id]: registerRectification,
  [registerLoanRepayment.id]: registerLoanRepayment,
};

export function getScenario(id: string): Scenario | undefined {
  return REGISTRY[id];
}

export function listScenarios(): Scenario[] {
  return Object.values(REGISTRY);
}
