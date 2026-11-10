/**
 * What the producer reads from the insurance system. Shapes are the insurance API's own, loosely
 * typed on purpose: the mapping (`infra/insurance/insuranceMapping.ts`) is the only place that knows them.
 */
export interface EligiblePage {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  size: number;
}

export interface InsuranceSourcePort {
  eligible(page: number): Promise<EligiblePage>;
  policy(policyId: string): Promise<Record<string, unknown>>;
  proposal(proposalId: string): Promise<Record<string, unknown>>;
}
