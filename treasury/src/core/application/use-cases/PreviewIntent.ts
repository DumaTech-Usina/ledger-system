import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine } from "../../domain/services/DialogEngine";
import { completenessOf, isWorthAsking } from "../../domain/services/PartyCompleteness";
import type { Candidate } from "../../domain/value-objects/Candidate";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { CandidateMapper } from "../services/CandidateMapper";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import { unidentifiedPartiesOf } from "../services/UnidentifiedParties";

/** One optional question, offered after the intent is already complete. Never blocks the submit. */
export interface EnrichmentSuggestion {
  partyId: string;
  displayName: string;
  attribute: string;
}

export interface PreviewIntentResult {
  intentId: string;
  scenarioTitle: string;
  answers: Record<string, string>;
  candidate: Candidate;
  /**
   * partyId → display name, for the confirmation card. Kept beside the candidate rather than inside
   * it: the candidate is what crosses into the Ledger, and a name has no business going there.
   */
  partyNames: Record<string, string>;
  /** Present when exactly one party in this candidate is worth one question. */
  enrichment?: EnrichmentSuggestion;
}

/**
 * Confirm-before-commit: build the exact candidate that WOULD be submitted, without changing state.
 * Powers the preview card so the user sees precisely what will be recorded.
 *
 * It is also where enrichment is offered, and that placement is the mechanism, not a convenience:
 * this use case refuses to run until the dialog is `ready`, so an enrichment question cannot happen
 * before the fact is complete. A defect in enrichment cannot hold a fact back, because enrichment
 * does not exist on the path that completes one.
 */
export class PreviewIntentUseCase {
  constructor(
    private readonly repo: IntentRepository,
    private readonly mapper: CandidateMapper,
    private readonly directory: PartyDirectoryPort,
  ) {}

  async execute(intentId: string): Promise<PreviewIntentResult> {
    const intent = await this.repo.findById(intentId);
    if (!intent) throw new Error(`Unknown intent: ${intentId}`);

    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    if (DialogEngine.nextState(scenario, intent.answers).kind !== "ready") {
      throw new Error("Intent is not ready to preview — required information is still missing.");
    }

    // Built twice: once to learn which parties are in play, then again with what the Directory
    // says about them. The second build is the one shown, and it matches what submit will send.
    const draft = this.mapper.build(intent, scenario);
    const candidate = this.mapper.build(
      intent,
      scenario,
      await unidentifiedPartiesOf(draft, this.directory),
    );
    const parties = await Promise.all(
      [...new Set(candidate.parties.map((p) => p.partyId))].map((id) => this.directory.get(id)),
    );

    const partyNames: Record<string, string> = {};
    for (const party of parties) {
      // A party the Directory does not know keeps its id on screen. Unknown is shown as unknown,
      // never papered over with an invented label.
      if (party) partyNames[party.partyId] = party.displayName;
    }

    const askable = parties.find((p) => p !== undefined && isWorthAsking(p));

    return {
      intentId: intent.id,
      scenarioTitle: scenario.title,
      answers: intent.answers,
      candidate,
      partyNames,
      // At most one question per confirmation — never a sequence.
      enrichment: askable
        ? {
            partyId: askable.partyId,
            displayName: askable.displayName,
            attribute: completenessOf(askable).missing[0],
          }
        : undefined,
    };
  }
}
