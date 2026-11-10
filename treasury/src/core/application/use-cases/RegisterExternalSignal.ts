import {
  ExternalSignal,
  type ExternalSignalProps,
  type PartyOutcome,
  type ProposedFact,
  type SignalKind,
} from "../../domain/entities/ExternalSignal";
import type { Party } from "../../domain/entities/Party";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { IntentStatus } from "../../domain/enums/IntentStatus";
import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine } from "../../domain/services/DialogEngine";
import {
  isSignalKind,
  proposalsFor,
  validateSignalFields,
  type FactProposal,
} from "../../domain/services/InsuranceSignal";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PartyRepository } from "../repositories/PartyRepository";
import type { ExternalSignalRepository } from "../repositories/ExternalSignalRepository";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import { localDay } from "../utils/instant";
import { signalFingerprint } from "../services/signalFingerprint";
import type { StartIntentUseCase } from "./StartIntent";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";

/** Who brings a signal in through the integration (REQ-805). */
export const INTEGRATION_AUTHOR = "system:seguro";

export interface RegisterExternalSignalInput {
  kind: SignalKind;
  fields: Record<string, unknown>;
  /** The user who filled the form. Ignored when `bySystem` is set. */
  userId: string;
  /**
   * Brought in by the integration: authored by the system, and a reading identical to the last one
   * of the same record is not stored again — the producer re-reads on a schedule, and the same
   * reading is not new knowledge.
   */
  bySystem?: boolean;
}

export interface RegisteredProposal extends ProposedFact {
  intentStatus: IntentStatus;
}

export interface RegisterExternalSignalResult {
  signal: ExternalSignalProps;
  proposals: RegisteredProposal[];
  /** True when the reading was identical to the last one and nothing was stored. */
  duplicate?: boolean;
}

/**
 * Records what the insurance system said and proposes the facts it reports (§4.6, block A).
 *
 * Nothing is sent to the Ledger here: each proposal is an ordinary intent, prefilled, that the user
 * confirms through the same preview and submit as any other (REQ-261, REQ-323). What the signal
 * cannot answer is asked in the conversation.
 *
 * The broker is found by the insurance system's id, never by the name on the statement (REQ-267):
 * one party with that id is used; none means a provisional identity carrying the id, so the next
 * signal finds it and a curator's link later carries every one of them to the registered party;
 * more than one is a doubt the user resolves in the conversation.
 *
 * Everything is checked before anything is stored, so a refused signal leaves neither a signal nor a
 * half-made intent behind. A fact an earlier reading already proposed is pointed at, not proposed
 * again (REQ-265); one the Ledger refused may be proposed anew.
 */
export class RegisterExternalSignalUseCase {
  constructor(
    private readonly signals: ExternalSignalRepository,
    private readonly intents: IntentRepository,
    private readonly startIntent: StartIntentUseCase,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly directory: PartyDirectoryPort,
    private readonly parties: PartyRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterExternalSignalInput): Promise<RegisterExternalSignalResult> {
    if (!isSignalKind(input.kind)) throw new Error(`Tipo de sinal desconhecido: ${String(input.kind)}`);

    const { fields, errors } = validateSignalFields(input.kind, input.fields ?? {});
    if (errors.length > 0) throw new Error(`Sinal recusado: ${errors.join("; ")}`);

    const author = input.bySystem ? INTEGRATION_AUTHOR : input.userId;
    const contentHash = signalFingerprint(input.kind, fields);
    if (input.bySystem) {
      const last = await this.signals.latestFor(input.kind, fields.policyId);
      if (last && last.toJSON().contentHash === contentHash) {
        return { signal: last.toJSON(), proposals: [], duplicate: true };
      }
    }

    const plans = proposalsFor(input.kind, fields);
    this.assertAnswersValid(plans);

    const signalId = this.ids.next();
    const proposals: RegisteredProposal[] = [];
    for (const plan of plans) {
      const standing = (await this.intents.findByOriginReference(plan.sourceReference)).find(
        (intent) => intent.status !== IntentStatus.REJECTED,
      );
      if (standing) {
        proposals.push({ fact: plan.fact, sourceReference: plan.sourceReference, intentId: standing.id, reused: true, intentStatus: standing.status });
        continue;
      }

      const party = plan.party ? await this.partyFor(plan.party, author) : undefined;
      const answers =
        plan.party && party && (party.outcome === "linked" || party.outcome === "provisional")
          ? [...plan.answers, { key: plan.party.slot, value: party.partyId }]
          : plan.answers;

      const { intentId } = await this.startIntent.execute({
        scenarioId: plan.scenarioId,
        userId: author,
        origin: {
          signalId,
          sourceReference: plan.sourceReference,
          confidence: "medium",
          ...(input.bySystem ? { reporter: { type: "system" as const, id: "seguro" } } : {}),
        },
        contexts: [plan.context],
      });
      const merged = await this.applyAnswers.execute({ intentId, answers });
      if (merged.rejected.length > 0) {
        // Checked above; reaching here means the scenario changed under the mapping.
        throw new Error(`Proposta inválida: ${merged.rejected.map((r) => r.message).join("; ")}`);
      }
      const intent = await this.intents.findById(intentId);
      proposals.push({
        fact: plan.fact,
        sourceReference: plan.sourceReference,
        intentId,
        reused: false,
        ...(party ? { party } : {}),
        intentStatus: intent?.status ?? IntentStatus.GATHERING,
      });
    }

    const signal = ExternalSignal.record({
      id: signalId,
      system: "insurance",
      kind: input.kind,
      recordId: fields.policyId,
      fields,
      contentHash,
      receivedAt: this.clock.now(),
      recordedBy: author,
      proposals: proposals.map(({ intentStatus: _, ...p }) => p),
    });
    await this.signals.add(signal);

    return { signal: signal.toJSON(), proposals };
  }

  /**
   * REQ-267, REQ-324: by the source's id only, within its registry — a broker's number never finds an
   * insurer. Read through curators' links, so a linked one is its party.
   */
  private async partyFor(need: NonNullable<FactProposal["party"]>, userId: string): Promise<PartyOutcome> {
    if (!need.externalId) return { outcome: "not_informed" };

    const holders = (await this.directory.list()).filter((p) =>
      p.externalIds.some((e) => e.system === need.registry && e.value === need.externalId),
    );
    const ids = [...new Set(holders.map((p) => p.mergedInto ?? p.partyId))].sort();
    if (ids.length === 1) return { outcome: "linked", partyId: ids[0] };
    if (ids.length > 1) return { outcome: "ambiguous", candidates: ids };

    const now = this.clock.now();
    const provisional: Party = {
      partyId: `party-${this.ids.next()}`,
      identityState: PartyIdentityState.PROVISIONAL,
      displayName: need.seenAs?.trim() || `${need.label} ${need.externalId} (sistema de seguro)`,
      aliases: [],
      externalIds: [{ system: need.registry, value: need.externalId }],
      attributes: {},
      createdBy: userId,
      createdAt: now,
    };
    await this.parties.save(provisional);
    return { outcome: "provisional", partyId: provisional.partyId };
  }

  /** The same validation the conversation applies, run up front (REQ-211, REQ-226). */
  private assertAnswersValid(plans: ReturnType<typeof proposalsFor>): void {
    const today = localDay(this.clock.now());
    const problems: string[] = [];
    for (const plan of plans) {
      const scenario = getScenario(plan.scenarioId);
      if (!scenario) throw new Error(`Unknown scenario: ${plan.scenarioId}`);
      for (const { key, value } of plan.answers) {
        const slot = scenario.slots.find((s) => s.key === key);
        if (!slot) {
          problems.push(`${key}: campo desconhecido`);
          continue;
        }
        const error = DialogEngine.validateAnswer(slot, value, today);
        if (error) problems.push(`${key}: ${error.message}`);
      }
    }
    if (problems.length > 0) throw new Error(`Sinal recusado: ${problems.join("; ")}`);
  }
}
