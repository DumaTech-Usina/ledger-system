import { SlotDefinition } from "../value-objects/Slot";
import { addCharge } from "./addCharge";
import { recordPurchase } from "./recordPurchase";

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
  [addCharge.id]: addCharge,
  [recordPurchase.id]: recordPurchase,
};

export function getScenario(id: string): Scenario | undefined {
  return REGISTRY[id];
}

export function listScenarios(): Scenario[] {
  return Object.values(REGISTRY);
}
