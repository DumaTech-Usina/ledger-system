import { Intent, type ContextRef, type IntentOrigin } from "../../domain/entities/Intent";
import { getScenario, type Scenario, defaultAnswers } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState } from "../../domain/services/DialogEngine";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import { userActor } from "../ports/AuditLog";
import type { ConversationLog } from "../ports/ConversationLog";

export interface StartIntentInput {
  scenarioId: string;
  userId: string;
  /** Set only when the intent is a fact proposed from an external signal (§4.6). */
  origin?: IntentOrigin;
  /** What the fact will cite as context (REQ-275). */
  contexts?: ContextRef[];
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
    private readonly log: ConversationLog,
  ) {}

  async execute(input: StartIntentInput): Promise<StartIntentResult> {
    const scenario = getScenario(input.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${input.scenarioId}`);

    const intent = Intent.start(
      this.ids.next(),
      scenario.id,
      input.userId,
      this.clock.now(),
      defaultAnswers(scenario),
      input.origin,
      input.contexts,
    );
    await this.repo.save(intent);
    await this.log.record({ actor: userActor(input.userId), intentId: intent.id, at: this.clock.now(), type: "intent.started", detail: scenario.id });

    return {
      intentId: intent.id,
      scenario: { id: scenario.id, title: scenario.title, description: scenario.description },
      state: DialogEngine.nextState(scenario, intent.answers),
    };
  }
}
