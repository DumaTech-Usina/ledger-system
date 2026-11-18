import { THE_CURRENCY } from "../../domain/value-objects/Slot";
import type { LedgerEventLookupPort } from "../ports/LedgerEventLookupPort";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { PositionLifecycle } from "../dtos/LedgerReadModels";
import { fromCents, toCents } from "../utils/cents";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { StartPositionActionUseCase } from "./StartPositionAction";
import type { SubmitIntentUseCase } from "./SubmitIntent";

/** A compensation the Treasury will not send, with the reason in the user's words. Nothing was sent. */
export class CompensationError extends Error {}

/** What the party owes the Usina, on the receivable side of a compensation (REQ-251, DEC-025). */
export const COMPENSABLE_RECEIVABLES = new Set(["advance", "loan"]);
/** What the Usina owes the party, on the payable side. */
export const COMPENSABLE_PAYABLES = new Set(["commission_payable"]);

export interface CompensationInput {
  /** The party whose page the pair was chosen on (REQ-252). */
  partyId: string;
  /** The advance or loan: what the party owes the Usina. */
  receivableId: string;
  /** The commission obligation: what the Usina owes the party. */
  payableId: string;
  amount: string;
  occurredAt: string;
  description?: string;
  by: string;
}

export interface CompensationResult {
  status: "accepted" | "rejected" | "awaiting_correction";
  intentId: string;
  ledgerReference?: string;
  reason?: string;
}

/**
 * A compensation of one pair (§8.11, REQ-693): an advance or a loan the party owes the Usina against a
 * commission obligation the Usina owes the party, both going down by the same amount, with no cash.
 *
 * Exactly one position per side. The Ledger's rule asks for at least one of each, and every position it
 * names goes down by the event's amount, so a second position on one side would take twice as much off
 * that side as off the other — valid for the Ledger, and not a compensation (decided 2026-11-18).
 *
 * Checked here, before anything is sent: the two kinds, the currency, that both are the same party's
 * (REQ-252, linked identities included), and that the amount fits both open balances. The Ledger
 * checks the amount again — it is the authority — and refuses the whole event if it does not fit.
 *
 * Sent through the same path as every other operation: an intent opened from the obligation (which
 * carries its contexts, REQ-275, and the party it is owed to), the answers merged by the same
 * validator, and the same submission, so the audit and the intents list show it like any other.
 */
export class CompensationUseCase {
  constructor(
    private readonly deps: {
      lifecycle: PositionLifecyclePort;
      events: LedgerEventLookupPort;
      directory: Pick<PartyDirectoryPort, "identifiersOf">;
      fromPosition: StartPositionActionUseCase;
      applyAnswers: ApplyAnswersUseCase;
      submit: SubmitIntentUseCase;
      usinaPartyId: string;
    },
  ) {}

  async execute(input: CompensationInput): Promise<CompensationResult> {
    const receivableId = input.receivableId?.trim();
    const payableId = input.payableId?.trim();
    if (!receivableId || !payableId) {
      throw new CompensationError("Escolha um item de cada lado: o que a parte deve à Usina e o que a Usina deve a ela.");
    }

    const [receivable, payable] = await Promise.all([
      this.deps.lifecycle.lifecycle(receivableId),
      this.deps.lifecycle.lifecycle(payableId),
    ]);
    if (!receivable) throw new CompensationError(`A posição ${receivableId} não está no Ledger.`);
    if (!payable) throw new CompensationError(`A posição ${payableId} não está no Ledger.`);

    if (!COMPENSABLE_RECEIVABLES.has(receivable.objectType)) {
      throw new CompensationError("Do lado do que a parte deve, a compensação aceita só adiantamento ou empréstimo.");
    }
    if (!COMPENSABLE_PAYABLES.has(payable.objectType)) {
      throw new CompensationError("Do lado do que a Usina deve, a compensação aceita só obrigação de comissão.");
    }
    if (receivable.currency !== THE_CURRENCY || payable.currency !== THE_CURRENCY) {
      throw new CompensationError(`A compensação é feita só em ${THE_CURRENCY}.`);
    }

    const amount = this.checkAmount(input.amount, receivable, payable);
    await this.checkSameParty(input.partyId, receivable, payable);

    const { intentId } = await this.deps.fromPosition.execute({
      objectId: payable.objectId,
      scenarioId: "register_compensation",
      userId: input.by,
    });
    const description = input.description?.trim();
    const merged = await this.deps.applyAnswers.execute({
      intentId,
      answers: [
        { key: "otherPositions", value: JSON.stringify([{ objectId: receivable.objectId, objectType: receivable.objectType }]) },
        { key: "amount", value: amount },
        { key: "occurredAt", value: input.occurredAt?.trim() ?? "" },
        ...(description ? [{ key: "description", value: description }] : []),
      ],
    });
    if (merged.rejected.length > 0) {
      throw new CompensationError(merged.rejected.map((r) => r.message).join("; "));
    }

    const outcome = await this.deps.submit.execute(intentId, input.by);
    return {
      status:
        outcome.intentStatus === "accepted"
          ? "accepted"
          : outcome.intentStatus === "awaiting_correction"
            ? "awaiting_correction"
            : "rejected",
      intentId,
      ...(outcome.ledgerReference ? { ledgerReference: outcome.ledgerReference } : {}),
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    };
  }

  /** Greater than zero and within both open balances; a balance the Ledger cannot state is refused. */
  private checkAmount(raw: string, receivable: PositionLifecycle, payable: PositionLifecycle): string {
    let cents: bigint;
    try {
      cents = toCents(raw ?? "");
    } catch {
      throw new CompensationError(`Valor inválido: ${raw}.`);
    }
    if (cents <= 0n) throw new CompensationError("O valor da compensação deve ser maior que zero.");
    for (const position of [receivable, payable]) {
      // Unknown is not zero (CLAUDE.md): one says the book cannot tell, the other that it is settled.
      if (position.openBalance === null) {
        throw new CompensationError(`A posição ${position.objectId} não tem saldo em aberto conhecido.`);
      }
      if (toCents(position.openBalance) <= 0n) {
        throw new CompensationError(`A posição ${position.objectId} já está quitada.`);
      }
    }
    const max = [receivable, payable].map((p) => toCents(p.openBalance!)).reduce((a, b) => (a < b ? a : b));
    if (cents > max) {
      throw new CompensationError(`O valor passa do menor saldo em aberto do par (${fromCents(max)}).`);
    }
    return fromCents(cents);
  }

  /**
   * REQ-252: both positions are the party's — the fact that opened each names the party, or an
   * identity linked to it. The Ledger keeps no owner per position, so this is the Treasury's call.
   */
  private async checkSameParty(partyId: string, ...positions: PositionLifecycle[]): Promise<void> {
    if (!partyId?.trim()) throw new CompensationError("Diga de qual parte é a compensação.");
    const mine = new Set(await this.deps.directory.identifiersOf(partyId.trim()));
    mine.add(partyId.trim());
    for (const position of positions) {
      const origination = position.events.find((e) => !e.retracted && e.relation === "originates");
      const event = origination ? await this.deps.events.event(origination.eventId) : null;
      const parties = (event?.parties ?? []).map((p) => p.partyId).filter((p) => p !== this.deps.usinaPartyId);
      if (!parties.some((p) => mine.has(p))) {
        throw new CompensationError(
          `A posição ${position.objectId} não é desta parte; a compensação é só entre posições da mesma parte.`,
        );
      }
    }
  }
}
