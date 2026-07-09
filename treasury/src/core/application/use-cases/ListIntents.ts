import { getScenario } from "../../domain/scenarios/Scenario";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { IntentStatus } from "../../domain/enums/IntentStatus";

export interface IntentSummary {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  status: IntentStatus;
  updatedAt: string;
}

/** The workspace list of a user's intents. */
export class ListIntentsUseCase {
  constructor(private readonly repo: IntentRepository) {}

  async execute(userId: string): Promise<IntentSummary[]> {
    const intents = await this.repo.listByUser(userId);
    return intents
      .map((i) => ({
        id: i.id,
        scenarioId: i.scenarioId,
        scenarioTitle: getScenario(i.scenarioId)?.title ?? i.scenarioId,
        status: i.status,
        updatedAt: i.toJSON().updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
