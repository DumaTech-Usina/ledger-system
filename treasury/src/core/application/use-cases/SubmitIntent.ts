import { getScenario } from "../../domain/scenarios/Scenario";
import { IntentStatus } from "../../domain/enums/IntentStatus";
import type { Candidate } from "../../domain/value-objects/Candidate";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { CandidateMapper } from "../services/CandidateMapper";
import type { CandidateSubmissionPort, SubmissionStatus, RejectionDetail } from "../ports/CandidateSubmissionPort";
import type { AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";

export interface SubmitIntentResult {
  intentId: string;
  /** Raw Ledger disposition (accepted | rejected). */
  status: SubmissionStatus;
  /** Resulting intent lifecycle status — the conversation branches on this. */
  intentStatus: IntentStatus;
  ledgerReference?: string;
  reason?: string;
  /** Structured rejections, when rejected (present from a contract-aware boundary). */
  rejections?: RejectionDetail[];
  /** When intentStatus is AWAITING_CORRECTION — the scenario slot keys the user should re-answer. */
  correction?: { slots: string[] };
  candidate: Candidate;
}

/**
 * Confirm → submit → dispose. Builds the candidate, submits it through the Ledger boundary, and
 * records the outcome. treasury proposes; the Ledger disposes. On a rejection it routes by the
 * rejection's category: a fixable (input/lineage) rejection with a re-askable slot puts the intent
 * in AWAITING_CORRECTION (non-terminal) so the conversation re-asks; duplicate/internal — or a
 * fixable rejection with no mappable slot — is terminal (REJECTED). The Ledger stays the authority;
 * treasury only interprets the structured outcome.
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
      await this.repo.save(intent);
      return {
        intentId,
        status: outcome.status,
        intentStatus: IntentStatus.ACCEPTED,
        ledgerReference: outcome.ledgerReference,
        candidate,
      };
    }

    // Rejected. Translate the fixable rejections' fields into re-askable scenario slots.
    const rejections = outcome.rejections ?? [];
    const correctionSlots = [
      ...new Set(
        rejections
          .filter((r) => r.category === "input" || r.category === "lineage")
          .map((r) => (r.field ? this.mapper.fieldToSlot(scenario.id, r.field) : undefined))
          .filter((key): key is string => !!key && scenario.slots.some((s) => s.key === key)),
      ),
    ];

    if (correctionSlots.length > 0) {
      // Non-terminal: the user fixes these slots (ApplyAnswers `edit`) and resubmits.
      intent.markAwaitingCorrection(this.clock.now());
      await this.audit.record({ intentId, at: this.clock.now(), type: "intent.correction", detail: correctionSlots.join(", ") });
      await this.repo.save(intent);
      return {
        intentId,
        status: outcome.status,
        intentStatus: IntentStatus.AWAITING_CORRECTION,
        reason: outcome.reason,
        rejections,
        correction: { slots: correctionSlots },
        candidate,
      };
    }

    // Terminal: duplicate / internal, or a fixable rejection with no mappable slot.
    intent.markRejected(outcome.reason ?? "Rejected by the Ledger.", this.clock.now());
    await this.audit.record({ intentId, at: this.clock.now(), type: "intent.rejected", detail: outcome.reason });
    await this.repo.save(intent);
    return {
      intentId,
      status: outcome.status,
      intentStatus: IntentStatus.REJECTED,
      reason: outcome.reason,
      rejections,
      candidate,
    };
  }
}
