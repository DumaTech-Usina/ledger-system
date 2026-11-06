import { getScenario } from "../../domain/scenarios/Scenario";
import type { IntentProps } from "../../domain/entities/Intent";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { AuditLog, AuditEntry } from "../ports/AuditLog";
import type { ConversationLog, ConversationEntry } from "../ports/ConversationLog";

export interface GetIntentResult {
  intent: IntentProps;
  scenarioTitle: string;
  /** The conversation's steps and the audit, in the order they happened. */
  history: (AuditEntry | ConversationEntry)[];
}

/** Intent detail + its history — powers the lifecycle/traceability view. */
export class GetIntentUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly audit: AuditLog,
    private readonly log: ConversationLog,
  ) {}

  async execute(intentId: string): Promise<GetIntentResult> {
    const intent = await this.repo.findById(intentId);
    if (!intent) throw new Error(`Unknown intent: ${intentId}`);

    const scenario = getScenario(intent.scenarioId);
    const [steps, audited] = await Promise.all([
      this.log.listByIntent(intentId),
      this.audit.listByIntent(intentId),
    ]);
    return {
      intent: intent.toJSON(),
      scenarioTitle: scenario?.title ?? intent.scenarioId,
      // Stable, so entries sharing a timestamp keep steps ahead of the submission they led to.
      history: [...steps, ...audited].sort((a, b) => a.at.localeCompare(b.at)),
    };
  }
}
