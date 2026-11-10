import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine } from "../../domain/services/DialogEngine";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import { fromCents, toCents } from "../utils/cents";
import { localDay } from "../utils/instant";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { StartIntentUseCase } from "./StartIntent";
import type { StartPositionActionUseCase } from "./StartPositionAction";
import type { SubmitIntentUseCase } from "./SubmitIntent";

const RECEIVED = "register_commission_received";

export interface RegisterInsurerCreditInput {
  /** Who paid: the insurer. */
  payer: string;
  /** What the bank shows came in. */
  creditAmount: string;
  occurredAt: string;
  /** How much of it goes to each expected commission. What is left over is unattributed. */
  allocations: { objectId: string; amount: string }[];
  userId: string;
}

export interface CreditStep {
  /** The expected commission settled, or null for the unattributed remainder. */
  objectId: string | null;
  amount: string;
  status: "accepted" | "rejected" | "awaiting_correction" | "not_sent";
  intentId?: string;
  ledgerReference?: string;
  reason?: string;
}

export interface RegisterInsurerCreditResult {
  batchId: string;
  unattributed: string;
  steps: CreditStep[];
}

/**
 * A credit from the insurer that covers several policies (§4.6, block D, REQ-277).
 *
 * One receipt per expected commission, each citing its policy (inherited, REQ-275) and the batch; the
 * remainder, if any, as a receipt without origin citing the batch — the money came in, so the cash is
 * complete, and the gap stays visible (`DEC-036` for linking it later). Everything is checked before
 * anything is sent. Then the receipts go one at a time, in order (REQ-255): a refusal stops the rest,
 * and what was accepted stays a fact.
 */
export class RegisterInsurerCreditUseCase {
  constructor(
    private readonly positions: PositionLifecyclePort,
    private readonly fromPosition: StartPositionActionUseCase,
    private readonly startIntent: StartIntentUseCase,
    private readonly applyAnswers: ApplyAnswersUseCase,
    private readonly submit: SubmitIntentUseCase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterInsurerCreditInput): Promise<RegisterInsurerCreditResult> {
    const remainder = await this.check(input);
    const batch = { objectId: `lote:${this.ids.next()}`, objectType: "settlement_batch" };

    const plan: { objectId: string | null; amount: string }[] = [
      ...input.allocations.map((a) => ({ objectId: a.objectId, amount: amountOf(a.amount) })),
      ...(remainder > 0n ? [{ objectId: null, amount: fromCents(remainder) }] : []),
    ];

    const steps: CreditStep[] = [];
    let stopped = false;
    for (const step of plan) {
      if (stopped) {
        steps.push({ ...step, status: "not_sent" });
        continue;
      }
      const intentId = step.objectId ? await this.allocated(input, step.objectId, step.amount, batch) : await this.unattributed(input, step.amount, batch);
      const outcome = await this.submit.execute(intentId, input.userId);
      const status = outcome.intentStatus === "accepted" ? "accepted" : outcome.intentStatus === "awaiting_correction" ? "awaiting_correction" : "rejected";
      steps.push({
        ...step,
        status,
        intentId,
        ...(outcome.ledgerReference ? { ledgerReference: outcome.ledgerReference } : {}),
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      });
      if (status !== "accepted") stopped = true;
    }

    return { batchId: batch.objectId, unattributed: fromCents(remainder), steps };
  }

  /** Every refusal happens here, before the first receipt leaves. Returns the unattributed cents. */
  private async check(input: RegisterInsurerCreditInput): Promise<bigint> {
    const scenario = getScenario(RECEIVED)!;
    const today = localDay(this.clock.now());
    const date = DialogEngine.validateAnswer(scenario.slots.find((s) => s.key === "occurredAt")!, input.occurredAt, today);
    if (date) throw new Error(`Data do crédito: ${date.message}`);
    if (!input.payer?.trim()) throw new Error("Informe a seguradora que pagou.");

    const credit = toCentsChecked(input.creditAmount, "Valor do crédito");
    if (credit <= 0n) throw new Error("O valor do crédito deve ser maior que zero.");

    const seen = new Set<string>();
    let allocated = 0n;
    for (const a of input.allocations) {
      if (seen.has(a.objectId)) throw new Error(`A comissão ${a.objectId} aparece mais de uma vez.`);
      seen.add(a.objectId);
      const amount = toCentsChecked(a.amount, `Valor para ${a.objectId}`);
      if (amount <= 0n) throw new Error(`O valor para ${a.objectId} deve ser maior que zero.`);
      const position = await this.positions.lifecycle(a.objectId);
      if (!position || position.objectType !== "commission_receivable") {
        throw new Error(`${a.objectId} não é uma comissão prevista conhecida.`);
      }
      if (position.openBalance !== null && amount > toCents(position.openBalance)) {
        throw new Error(`O valor para ${a.objectId} passa do que está aberto (${position.openBalance}).`);
      }
      allocated += amount;
    }
    if (allocated > credit) {
      throw new Error(`O distribuído (${fromCents(allocated)}) passa do valor do crédito (${fromCents(credit)}).`);
    }
    return credit - allocated;
  }

  /** A receipt on an expected commission, opened from it so lineage, policy and payer come along. */
  private async allocated(
    input: RegisterInsurerCreditInput,
    objectId: string,
    amount: string,
    batch: { objectId: string; objectType: string },
  ): Promise<string> {
    const { intentId } = await this.fromPosition.execute({
      objectId,
      scenarioId: RECEIVED,
      userId: input.userId,
      extraContexts: [batch],
    });
    await this.answer(intentId, input, amount);
    return intentId;
  }

  /** The remainder: money that came in with no known origin yet (REQ-277). Never given one. */
  private async unattributed(
    input: RegisterInsurerCreditInput,
    amount: string,
    batch: { objectId: string; objectType: string },
  ): Promise<string> {
    const { intentId } = await this.startIntent.execute({ scenarioId: RECEIVED, userId: input.userId, contexts: [batch] });
    await this.answer(intentId, input, amount);
    return intentId;
  }

  private async answer(intentId: string, input: RegisterInsurerCreditInput, amount: string): Promise<void> {
    const merged = await this.applyAnswers.execute({
      intentId,
      answers: [
        { key: "payer", value: input.payer },
        { key: "amount", value: amount },
        { key: "occurredAt", value: input.occurredAt },
      ],
    });
    if (merged.rejected.length > 0) {
      throw new Error(`Não foi possível montar o recebimento: ${merged.rejected.map((r) => r.message).join("; ")}`);
    }
  }
}

const amountOf = (amount: string): string => fromCents(toCents(amount));

function toCentsChecked(amount: string, label: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(amount?.trim() ?? "")) throw new Error(`${label}: valor inválido (${amount}).`);
  return toCents(amount);
}
