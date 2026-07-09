import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine } from "../../domain/services/DialogEngine";
import type { Candidate } from "../../domain/value-objects/Candidate";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { CandidateMapper } from "../services/CandidateMapper";

export interface PreviewIntentResult {
  intentId: string;
  scenarioTitle: string;
  answers: Record<string, string>;
  candidate: Candidate;
}

/**
 * Confirm-before-commit: build the exact candidate that WOULD be submitted, without changing state.
 * Powers the preview card so the user sees precisely what will be recorded.
 */
export class PreviewIntentUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly mapper: CandidateMapper,
  ) {}

  async execute(intentId: string): Promise<PreviewIntentResult> {
    const intent = await this.repo.findById(intentId);
    if (!intent) throw new Error(`Unknown intent: ${intentId}`);

    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    if (DialogEngine.nextState(scenario, intent.answers).kind !== "ready") {
      throw new Error("Intent is not ready to preview — required information is still missing.");
    }

    return {
      intentId: intent.id,
      scenarioTitle: scenario.title,
      answers: intent.answers,
      candidate: this.mapper.build(intent, scenario),
    };
  }
}
