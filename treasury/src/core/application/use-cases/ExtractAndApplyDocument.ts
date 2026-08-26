import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState } from "../../domain/services/DialogEngine";
import { SlotType } from "../../domain/enums/SlotType";
import type { SlotDefinition } from "../../domain/value-objects/Slot";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { FileExtractionPort } from "../ports/FileExtractionPort";
import type { RawDocument, ExtractionResult } from "../dtos/ExtractionModels";
import { ApplyAnswersUseCase } from "./ApplyAnswers";
import { isRecordable, type IdentityOutcome } from "../services/IdentitySlotResolution";

export interface ExtractAndApplyDocumentInput {
  intentId: string;
  file: RawDocument;
}

export interface ExtractAndApplyDocumentResult {
  extraction: ExtractionResult;
  state: DialogState;
  /** The full slot definitions the extracted data was successfully recorded into — not just their
   * keys — so the guided chat can register them (e.g. for "Editar") exactly like any slot it asks
   * about directly, without a second lookup. */
  applied: SlotDefinition[];
  /**
   * Slots that could not be filled, and why — carrying the full definition (not just the key), the
   * same way `applied` does, so the guided chat can show a proper label without having asked about
   * the slot yet itself.
   */
  skipped: { slot: SlotDefinition; reason: string }[];
  /**
   * One entry per PARTY field the extraction proposed. An outcome that did not resolve to exactly
   * one known party left that slot blank — same as any other identity outcome in this app — for
   * the guided chat to offer the usual select/create/unidentifiable decision on, instead of this
   * use case inventing its own resolution UI.
   */
  identity: IdentityOutcome[];
}

/** One extracted field paired with a predicate that finds the scenario slot it targets. */
interface Candidate {
  value: string | undefined;
  matches: (slot: SlotDefinition) => boolean;
}

/**
 * Bridges a file-extraction result into the SAME deterministic batch-merge path natural-language
 * interpretation already uses — `ApplyAnswersUseCase` in `fill` mode (see
 * `InterpretUtteranceUseCase.mergeProposals`, its closest sibling). It never touches
 * `Candidate`/`CandidateMapper` directly and duplicates none of `DialogEngine`'s validation or
 * `IdentitySlotResolution`'s party lookup — both are inherited for free through `ApplyAnswersUseCase`.
 *
 * Each extracted field is matched to the current scenario's unanswered slot of the corresponding
 * `SlotType` (PARTY → counterparty, MONEY → amount, DATE → date). Every scenario declares at most
 * one slot of each of those types, so "first unanswered slot of this type" is unambiguous. CHOICE
 * and STRING are narrowed further, to the "currency" and "description" keys specifically: several
 * scenarios carry OTHER CHOICE/STRING slots (e.g. "kind", "basis", "objectRef") that mean something
 * a document extractor has no basis to guess at. This generalizes to any future scenario without
 * change: it never hardcodes a scenario id, and a scenario without a "currency"/"description" slot
 * simply leaves that field unmatched.
 */
export class ExtractAndApplyDocumentUseCase {
  constructor(
    private readonly fileExtraction: FileExtractionPort,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly intentRepo: IntentRepository,
  ) {}

  async execute(input: ExtractAndApplyDocumentInput): Promise<ExtractAndApplyDocumentResult> {
    const extraction = await this.fileExtraction.extract(input.file);

    const intent = await this.intentRepo.findById(input.intentId);
    if (!intent) throw new Error(`Unknown intent: ${input.intentId}`);
    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    const state = DialogEngine.nextState(scenario, intent.answers);
    if (!extraction.success) {
      return { extraction, state, applied: [], skipped: [], identity: [] };
    }

    const candidates: Candidate[] = [
      { value: extraction.data.counterparty, matches: (s) => s.type === SlotType.PARTY },
      { value: extraction.data.amount, matches: (s) => s.type === SlotType.MONEY },
      { value: extraction.data.date, matches: (s) => s.type === SlotType.DATE },
      { value: extraction.data.currency, matches: (s) => s.type === SlotType.CHOICE && s.key === "currency" },
      { value: extraction.data.description, matches: (s) => s.type === SlotType.STRING && s.key === "description" },
    ];

    const answers: { key: string; value: string }[] = [];
    const targeted: SlotDefinition[] = [];
    const skipped: { slot: SlotDefinition; reason: string }[] = [];

    for (const { value, matches } of candidates) {
      const slot = scenario.slots.find((s) => matches(s) && !intent.answers[s.key]);
      if (!slot) continue; // this scenario has no unanswered slot of this kind — nothing to prefill

      if (!value) {
        // Only worth reporting when the guided chat will actually ask about it — an optional slot
        // that couldn't be extracted has no follow-up question, so silently skipping it avoids a
        // dead-end "fill this in" message.
        if (slot.required) skipped.push({ slot, reason: "Não foi possível extrair este dado do documento." });
        continue;
      }
      targeted.push(slot);
      answers.push({ key: slot.key, value });
    }

    const merged = await this.applyAnswers.execute({ intentId: input.intentId, answers, mode: "fill" });

    const rejectedByKey = new Map(merged.rejected.map((r) => [r.key, r.message]));
    const unresolvedIdentityKeys = new Set(
      merged.identity.filter((outcome) => !isRecordable(outcome.resolution)).map((outcome) => outcome.slot),
    );
    for (const slot of targeted) {
      const rejection = rejectedByKey.get(slot.key);
      if (rejection) skipped.push({ slot, reason: rejection });
    }

    const applied = targeted.filter((slot) => !rejectedByKey.has(slot.key) && !unresolvedIdentityKeys.has(slot.key));

    return { extraction, state: merged.state, applied, skipped, identity: merged.identity };
  }
}
