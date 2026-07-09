import { Intent } from "../../domain/entities/Intent";
import { getScenario, type Scenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState } from "../../domain/services/DialogEngine";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import type { AuditLog } from "../ports/AuditLog";

export interface StartIntentInput {
  scenarioId: string;
  userId: string;
}

export interface StartIntentResult {
  intentId: string;
  scenario: Pick<Scenario, "id" | "title" | "description">;
  state: DialogState;
}

export class StartIntentUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
  ) {}

  async execute(input: StartIntentInput): Promise<StartIntentResult> {
    const scenario = getScenario(input.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${input.scenarioId}`);

    const intent = Intent.start(this.ids.next(), scenario.id, input.userId, this.clock.now());
    await this.repo.save(intent);
    await this.audit.record({ intentId: intent.id, at: this.clock.now(), type: "intent.started", detail: scenario.id });

    return {
      intentId: intent.id,
      scenario: { id: scenario.id, title: scenario.title, description: scenario.description },
      state: DialogEngine.nextState(scenario, intent.answers),
    };
  }
}
