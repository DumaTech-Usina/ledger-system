import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine, type DialogState } from "../../domain/services/DialogEngine";
import { SlotType } from "../../domain/enums/SlotType";
import type { SlotDefinition } from "../../domain/value-objects/Slot";
import type { IntentRepository } from "../repositories/IntentRepository";
import type { FileExtractionPort } from "../ports/FileExtractionPort";
import type { RawDocument, ExtractionResult } from "../dtos/ExtractionModels";
import { AdvanceDialogUseCase } from "./AdvanceDialog";

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
  /** Slot keys that could not be filled, and why — the guided chat falls back to asking these. */
  skipped: { slotKey: string; reason: string }[];
}

/**
 * Bridges a file-extraction result into the SAME slot-answering path a human uses — it never
 * touches `Candidate`/`CandidateMapper` directly, and duplicates none of `DialogEngine`'s
 * validation. Each extracted field is matched to the current scenario's unanswered slot of the
 * matching `SlotType` (PARTY → counterparty, MONEY → amount, DATE → date, CHOICE → currency,
 * STRING → description) and applied through the injected `AdvanceDialogUseCase` instance, exactly
 * like `Composer`/`saveEdits` already do. This also means it generalizes to any future scenario
 * without change: it never hardcodes a slot key.
 */
export class ExtractAndApplyDocumentUseCase {
  constructor(
    private readonly fileExtraction: FileExtractionPort,
    private readonly advanceDialog: AdvanceDialogUseCase,
    private readonly intentRepo: IntentRepository,
  ) {}

  async execute(input: ExtractAndApplyDocumentInput): Promise<ExtractAndApplyDocumentResult> {
    const extraction = await this.fileExtraction.extract(input.file);

    const intent = await this.intentRepo.findById(input.intentId);
    if (!intent) throw new Error(`Unknown intent: ${input.intentId}`);
    const scenario = getScenario(intent.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${intent.scenarioId}`);

    const answersBeforeExtraction = intent.answers;
    const applied: SlotDefinition[] = [];
    const skipped: { slotKey: string; reason: string }[] = [];

    const candidates: { value: string | undefined; slotType: SlotType }[] = [
      { value: extraction.data.counterparty, slotType: SlotType.PARTY },
      { value: extraction.data.amount, slotType: SlotType.MONEY },
      { value: extraction.data.date, slotType: SlotType.DATE },
      { value: extraction.data.currency, slotType: SlotType.CHOICE },
      { value: extraction.data.description, slotType: SlotType.STRING },
    ];

    if (extraction.success) {
      for (const { value, slotType } of candidates) {
        const slot = scenario.slots.find((s) => s.type === slotType && !answersBeforeExtraction[s.key]);
        if (!slot) continue; // this scenario has no unanswered slot of this kind — nothing to prefill

        if (!value) {
          // Only worth reporting when the guided chat will actually ask about it — an optional
          // slot (e.g. a free-text description) that couldn't be extracted has no follow-up
          // question, so silently skipping it avoids a dead-end "fill this in" message.
          if (slot.required) skipped.push({ slotKey: slot.key, reason: "Não foi possível extrair este dado do documento." });
          continue;
        }
        const outcome = await this.advanceDialog.execute({ intentId: input.intentId, key: slot.key, value });
        if (outcome.error) skipped.push({ slotKey: slot.key, reason: outcome.error.message });
        else applied.push(slot);
      }
    }

    const updated = await this.intentRepo.findById(input.intentId);
    const state = DialogEngine.nextState(scenario, updated?.answers ?? answersBeforeExtraction);

    return { extraction, state, applied, skipped };
  }
}
