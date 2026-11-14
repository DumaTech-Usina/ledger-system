import { getScenario } from "../../domain/scenarios/Scenario";
import { DialogEngine } from "../../domain/services/DialogEngine";
import { THE_CURRENCY } from "../../domain/value-objects/Slot";
import type { Clock } from "../ports/Clock";
import type { LedgerEventLookupPort } from "../ports/LedgerEventLookupPort";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import { producibleTuples } from "../services/CandidateMapper";
import {
  PreparedBatchError,
  type BatchPayment,
  type BatchPaymentStep,
  type PreparedBatch,
  type PreparedBatches,
} from "../services/PreparedBatches";
import { fromCents, toCents } from "../utils/cents";
import { localDay } from "../utils/instant";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { StartPositionActionUseCase } from "./StartPositionAction";
import type { SubmitIntentUseCase } from "./SubmitIntent";

/** An institution the Usina's money moves in (REQ-650). The key is written into facts: it never changes. */
export interface Institution {
  key: string;
  name: string;
}

/** Reads `key=Name,key=Name`. Refuses a key that could not be part of an object id, or one given twice. */
export function institutionsFrom(raw: string): Institution[] {
  const list = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, ...name] = pair.split("=");
      return { key: key.trim(), name: name.join("=").trim() };
    });
  for (const { key, name } of list) {
    if (!/^[a-z0-9-]+$/.test(key) || !name) throw new Error(`CASH_INSTITUTIONS: "${key}=${name}" is not key=Name with a key in a-z, 0-9 and -.`);
  }
  if (new Set(list.map((i) => i.key)).size !== list.length) throw new Error("CASH_INSTITUTIONS: a key appears twice.");
  return list;
}

/** The context a cash fact cites to say where the money moved (REQ-650, DEC-044). */
export const institutionContext = (key: string) => ({ objectId: `instituicao:${key}`, objectType: "cash_account" });

/** One line of a batch, as the interface shows it. */
export interface BatchLineView {
  objectId: string;
  objectType: string | null;
  amount: string;
  payee: { partyId: string; displayName: string } | null;
  step?: BatchPaymentStep;
}

export interface BatchView {
  batchId: string;
  preparedBy: string;
  preparedAt: string;
  /** The sum of the amounts the user chose (REQ-246): the Treasury's own figures, never Ledger balances. */
  total: string;
  lines: BatchLineView[];
  payment?: Omit<BatchPayment, "steps"> & {
    /** What the Ledger accepted, and the gap to the bank's debit (REQ-249). */
    recorded: string;
    difference: string;
  };
}

export interface PayablesBatchesView {
  institutions: Institution[];
  standing: BatchView[];
  recent: BatchView[];
}

/** Display names, when a directory is at hand. */
export interface PartyNames {
  displayNameOf(partyId: string): Promise<string | null>;
}

const RECENT = 10;

/**
 * The scenario that settles a position of this type, derived from what Treasury can produce — never a
 * list kept by hand. Only a single-position settlement qualifies: the batch pays one obligation per
 * event (REQ-246). Null when there is none, or more than one and the choice is not Treasury's to make.
 */
export function settlingScenario(objectType: string): string | null {
  const found = producibleTuples().filter(
    (t) => t.objectType === objectType && t.relation === "settles" && !t.touchesOtherPositions && !t.variantChoice,
  );
  const scenarios = [...new Set(found.map((t) => t.scenarioId))];
  return scenarios.length === 1 ? scenarios[0] : null;
}

/**
 * The day's payments, in one go (§8.6, E3).
 *
 * Preparing reads each obligation from the Ledger and keeps what paying will need — who is paid, and
 * the scenario that settles it — so the batch is a draft the user can trust (REQ-651). Paying checks
 * the bank's debit against the batch before anything leaves (REQ-653), takes the batch so it cannot be
 * paid twice (REQ-654), and then sends one event per line through the same conversation every other
 * payment uses, each citing the batch and the institution. A refusal does not stop the rest (REQ-249).
 */
export class PayablesBatchUseCase {
  constructor(
    private readonly deps: {
      batches: PreparedBatches;
      lifecycle: PositionLifecyclePort;
      events: LedgerEventLookupPort;
      fromPosition: StartPositionActionUseCase;
      applyAnswers: ApplyAnswersUseCase;
      submit: SubmitIntentUseCase;
      clock: Clock;
      usinaPartyId: string;
      institutions: Institution[];
      names?: PartyNames;
      /** Treasury's users, to name who prepared and who paid. Without it, the id is shown. */
      users?: { findById(id: string): Promise<{ displayName: string } | null> };
    },
  ) {}

  institutions(): Institution[] {
    return this.deps.institutions;
  }

  /** REQ-651: a batch assembled on the agenda, of one or several creditors. */
  async prepare(input: { items: { objectId: string; amount: string }[]; by: string }): Promise<{ batchId: string }> {
    if (!input.items?.length) throw new PreparedBatchError("Escolha ao menos uma obrigação.");
    const items = [];
    for (const item of input.items) {
      const objectId = item.objectId?.trim();
      if (!objectId) throw new PreparedBatchError("Toda linha do lote precisa da obrigação.");
      items.push({ ...(await this.line(objectId, item.amount)), amount: item.amount?.trim() });
    }
    return this.deps.batches.prepare({ partyId: null, items, by: input.by });
  }

  async discard(batchId: string, by: string): Promise<void> {
    await this.deps.batches.discard(batchId, by);
  }

  /** REQ-653: the payment the bank made, recorded as one event per line. */
  async pay(input: { batchId: string; occurredAt: string; institution: string | null | undefined; debit: string; by: string }): Promise<BatchView> {
    const batch = await this.deps.batches.get(input.batchId);
    if (!batch) throw new PreparedBatchError(`O lote ${input.batchId} não existe.`);
    if (batch.payment) throw new PreparedBatchError("O pagamento deste lote já foi anotado.");
    if (batch.discarded) throw new PreparedBatchError("Este lote foi descartado; prepare outro.");

    // Every refusal happens before the batch is taken, so a refused attempt leaves it standing.
    const occurredAt = this.checkDate(input.occurredAt);
    const institution = this.checkInstitution(input.institution);
    const debit = checkAmount(input.debit, "Valor debitado no banco");
    const total = sum(batch.items.map((i) => i.amount));
    if (debit !== total) {
      // REJ-653: the events must add up to the single debit the bank shows.
      throw new PreparedBatchError(
        `O débito no banco (${fromCents(debit)}) não bate com a soma do lote (${fromCents(total)}). Nada foi enviado.`,
      );
    }
    const unpayable = batch.items.find((i) => !i.payee || !i.scenarioId);
    if (unpayable) {
      throw new PreparedBatchError(`A obrigação ${unpayable.objectId} não tem credor ou forma de pagamento conhecidos; pague-a pela posição.`);
    }

    const taken = await this.deps.batches.startPayment(batch.batchId, {
      by: input.by,
      occurredAt,
      institution,
      debit: fromCents(debit),
    });
    const payment = taken.payment!;
    const contexts = [
      { objectId: `lote:${batch.batchId}`, objectType: "settlement_batch" },
      ...(institution ? [institutionContext(institution)] : []),
    ];

    for (const item of batch.items) {
      payment.steps.push(await this.payLine(item as Required<typeof item>, occurredAt, contexts, input.by));
      await this.deps.batches.recordProgress(taken);
    }
    payment.state = "recorded";
    await this.deps.batches.recordProgress(taken);
    return this.view(taken);
  }

  async list(): Promise<PayablesBatchesView> {
    const [standing, recent] = await Promise.all([this.deps.batches.standing(), this.deps.batches.recentlyPaid(RECENT)]);
    return {
      institutions: this.deps.institutions,
      standing: await Promise.all(standing.map((b) => this.view(b))),
      recent: await Promise.all(recent.map((b) => this.view(b))),
    };
  }

  /** What paying this obligation needs, read from the Ledger; refused when the batch cannot pay it. */
  private async line(objectId: string, amount: string) {
    const position = await this.deps.lifecycle.lifecycle(objectId);
    if (!position) throw new PreparedBatchError(`A obrigação ${objectId} não está no Ledger.`);
    if (position.currency !== THE_CURRENCY) {
      throw new PreparedBatchError(`A obrigação ${objectId} é em ${position.currency}; o lote paga só em ${THE_CURRENCY}.`);
    }
    const scenarioId = settlingScenario(position.objectType);
    if (!scenarioId) throw new PreparedBatchError(`A obrigação ${objectId} (${position.objectType}) não pode ser paga em lote.`);

    const cents = checkAmount(amount, `Valor para ${objectId}`);
    if (cents <= 0n) throw new PreparedBatchError(`O valor para ${objectId} deve ser maior que zero.`);
    if (position.openBalance === null || toCents(position.openBalance) <= 0n) {
      throw new PreparedBatchError(`A obrigação ${objectId} não tem saldo em aberto conhecido.`);
    }
    if (cents > toCents(position.openBalance)) {
      // Q-048, prevention: a batch never pays more than is open.
      throw new PreparedBatchError(`O valor para ${objectId} passa do que está em aberto (${position.openBalance}).`);
    }

    // Who is paid is who the obligation is owed to, as the fact that opened it says. Unknown or more
    // than one, the batch does not choose: the obligation is paid from its position (REQ-651).
    const origination = position.events.find((e) => !e.retracted && e.relation === "originates");
    const event = origination ? await this.deps.events.event(origination.eventId) : null;
    const creditors = [...new Set((event?.parties ?? []).map((p) => p.partyId).filter((p) => p !== this.deps.usinaPartyId))];
    if (creditors.length !== 1) {
      throw new PreparedBatchError(
        creditors.length === 0
          ? `A obrigação ${objectId} não tem credor conhecido; pague-a pela posição.`
          : `A obrigação ${objectId} tem mais de um credor; pague-a pela posição.`,
      );
    }
    return { objectId, objectType: position.objectType, scenarioId, payee: creditors[0] };
  }

  private async payLine(
    item: { objectId: string; amount: string; payee: string; scenarioId: string },
    occurredAt: string,
    contexts: { objectId: string; objectType: string }[],
    by: string,
  ): Promise<BatchPaymentStep> {
    const step = { objectId: item.objectId, amount: item.amount };
    let intentId: string | undefined;
    try {
      ({ intentId } = await this.deps.fromPosition.execute({
        objectId: item.objectId,
        scenarioId: item.scenarioId,
        userId: by,
        extraContexts: contexts,
      }));
      const merged = await this.deps.applyAnswers.execute({
        intentId,
        answers: [
          { key: "payee", value: item.payee },
          { key: "amount", value: item.amount },
          { key: "occurredAt", value: occurredAt },
        ],
      });
      if (merged.rejected.length > 0) {
        return { ...step, status: "failed", intentId, reason: merged.rejected.map((r) => r.message).join("; ") };
      }
      const outcome = await this.deps.submit.execute(intentId, by);
      const status =
        outcome.intentStatus === "accepted" ? "accepted" : outcome.intentStatus === "awaiting_correction" ? "awaiting_correction" : "rejected";
      return {
        ...step,
        status,
        intentId,
        ...(outcome.ledgerReference ? { ledgerReference: outcome.ledgerReference } : {}),
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      };
    } catch (err) {
      // REQ-249: the money already left the bank; one line that fails does not stop the others.
      return { ...step, status: "failed", ...(intentId ? { intentId } : {}), reason: err instanceof Error ? err.message : String(err) };
    }
  }

  private checkDate(occurredAt: string): string {
    const slot = getScenario("register_payment")!.slots.find((s) => s.key === "occurredAt")!;
    const problem = DialogEngine.validateAnswer(slot, occurredAt, localDay(this.deps.clock.now()));
    if (problem) throw new PreparedBatchError(`Data do pagamento: ${problem.message}`);
    return occurredAt.trim();
  }

  /** The institution is chosen or explicitly "not stated" (null); never filled in by assumption. */
  private checkInstitution(institution: string | null | undefined): string | null {
    if (institution === undefined) throw new PreparedBatchError("Escolha a instituição de onde o dinheiro saiu, ou marque \"não informada\".");
    if (institution === null) return null;
    if (!this.deps.institutions.some((i) => i.key === institution)) throw new PreparedBatchError(`Instituição desconhecida: ${institution}.`);
    return institution;
  }

  private async view(batch: PreparedBatch): Promise<BatchView> {
    const names = new Map<string, string | null>();
    for (const payee of new Set(batch.items.map((i) => i.payee ?? batch.partyId).filter((p): p is string => !!p))) {
      names.set(payee, (await this.deps.names?.displayNameOf(payee)) ?? null);
    }
    const steps = new Map((batch.payment?.steps ?? []).map((s) => [s.objectId, s]));
    const lines: BatchLineView[] = batch.items.map((item) => {
      const payee = item.payee ?? batch.partyId;
      const step = steps.get(item.objectId) ?? (batch.payment ? { objectId: item.objectId, amount: item.amount, status: "not_sent" as const } : undefined);
      return {
        objectId: item.objectId,
        objectType: item.objectType ?? null,
        amount: item.amount,
        payee: payee ? { partyId: payee, displayName: names.get(payee) ?? payee } : null,
        ...(step ? { step } : {}),
      };
    });
    const who = async (id: string) => (await this.deps.users?.findById(id))?.displayName ?? id;
    const view: BatchView = {
      batchId: batch.batchId,
      preparedBy: await who(batch.preparedBy),
      preparedAt: batch.preparedAt,
      total: fromCents(sum(batch.items.map((i) => i.amount))),
      lines,
    };
    if (batch.payment) {
      const { steps: _steps, ...payment } = batch.payment;
      const recorded = sum(batch.payment.steps.filter((s) => s.status === "accepted").map((s) => s.amount));
      view.payment = { ...payment, by: await who(payment.by), recorded: fromCents(recorded), difference: fromCents(toCents(payment.debit) - recorded) };
    }
    return view;
  }
}

function sum(amounts: string[]): bigint {
  return amounts.reduce((acc, a) => acc + toCents(a), 0n);
}

function checkAmount(amount: string, label: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(amount?.trim() ?? "")) throw new PreparedBatchError(`${label}: valor inválido (${amount}).`);
  return toCents(amount.trim());
}
