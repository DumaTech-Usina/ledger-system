import { getScenario } from "../../domain/scenarios/Scenario";
import type { Candidate } from "../../domain/value-objects/Candidate";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { CandidateMapper } from "../services/CandidateMapper";
import type { CandidateSubmissionPort, SubmissionStatus } from "../ports/CandidateSubmissionPort";
import type { AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";

export interface SubmitIntentResult {
  intentId: string;
  status: SubmissionStatus;
  ledgerReference?: string;
  reason?: string;
  candidate: Candidate;
}

/**
 * Confirm → submit → dispose. Builds the candidate, submits it through the (stubbed) Ledger
 * boundary, records the outcome on the intent and in the audit trail. treasury proposes; the
 * Ledger (here, the stub) disposes.
 */
export class SubmitIntentUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly mapper: CandidateMapper,
    private readonly submission: CandidateSubmissionPort,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(intentId: string): Promise<SubmitIntentResult> {
    const intent = await this.repo.findById(intentId);
    if (!intent) throw new Error(`Unknown intent: ${intentId}`);

    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    intent.markSubmitted(this.clock.now()); // guard first: throws if not awaiting confirmation
    const candidate = this.mapper.build(intent, scenario);
    await this.audit.record({ intentId, at: this.clock.now(), type: "intent.submitted", detail: candidate.sourceReference });

    const outcome = await this.submission.submit(candidate);

    if (outcome.status === "accepted") {
      intent.markAccepted(outcome.ledgerReference ?? "", this.clock.now());
      await this.audit.record({ intentId, at: this.clock.now(), type: "intent.accepted", detail: outcome.ledgerReference });
    } else {
      intent.markRejected(outcome.reason ?? "Rejected by the Ledger.", this.clock.now());
      await this.audit.record({ intentId, at: this.clock.now(), type: "intent.rejected", detail: outcome.reason });
    }

    await this.repo.save(intent);

    return {
      intentId,
      status: outcome.status,
      ledgerReference: outcome.ledgerReference,
      reason: outcome.reason,
      candidate,
    };
  }
}
