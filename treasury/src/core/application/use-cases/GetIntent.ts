import { getScenario } from "../../domain/scenarios/Scenario";
import type { IntentProps } from "../../domain/entities/Intent";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { AuditLog, AuditEntry } from "../ports/AuditLog";

export interface GetIntentResult {
  intent: IntentProps;
  scenarioTitle: string;
  history: AuditEntry[];
}

/** Intent detail + its append-only history — powers the lifecycle/traceability view. */
export class GetIntentUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly audit: AuditLog,
  ) {}

  async execute(intentId: string): Promise<GetIntentResult> {
    const intent = await this.repo.findById(intentId);
    if (!intent) throw new Error(`Unknown intent: ${intentId}`);

    const scenario = getScenario(intent.scenarioId);
    return {
      intent: intent.toJSON(),
      scenarioTitle: scenario?.title ?? intent.scenarioId,
      history: await this.audit.listByIntent(intentId),
    };
  }
}
