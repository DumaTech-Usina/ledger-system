import type { IntentRepository } from "../repositories/IntentRepository";
import type { AuditLog } from "../ports/AuditLog";
import { userActor } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";

/** The scenario every proposed obligation runs in (REQ-262, REQ-283). */
const OBLIGATION_SCENARIO = "register_obligation_recognition";

export interface DismissProposedObligationInput {
  intentId: string;
  userId: string;
}

export interface DismissProposedObligationResult {
  intentId: string;
  status: "dismissed";
  dismissedBy: string;
  dismissedAt: string;
}

/**
 * REQ-286: "não há obrigação". The user declares that the obligation a signal proposed does not
 * exist — the health system named a broker or a supervisor, but this installment owes them nothing.
 *
 * It is a decision of the Treasury, not a fact: nothing is sent to the Ledger. The proposal is closed
 * for good, so a later reading of the same installment does not propose it again (REQ-265), and the
 * audit keeps who decided and when (REQ-804). Changing one's mind is recording the obligation by hand.
 */
export class DismissProposedObligationUseCase {
  constructor(
    private readonly intents: IntentRepository,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(input: DismissProposedObligationInput): Promise<DismissProposedObligationResult> {
    const intent = await this.intents.findById(input.intentId);
    if (!intent) throw new Error(`Proposta desconhecida: ${input.intentId}`);
    if (!intent.origin || intent.scenarioId !== OBLIGATION_SCENARIO) {
      throw new Error("Só uma obrigação proposta por um sinal pode ser declarada inexistente.");
    }

    const now = this.clock.now();
    intent.dismiss(input.userId, now);
    await this.intents.save(intent);
    await this.audit.record({
      actor: userActor(input.userId),
      intentId: intent.id,
      at: now,
      type: "proposal.dismissed",
      detail: `no_obligation:${intent.origin.sourceReference}`,
    });
    return { intentId: intent.id, status: "dismissed", dismissedBy: input.userId, dismissedAt: now };
  }
}
