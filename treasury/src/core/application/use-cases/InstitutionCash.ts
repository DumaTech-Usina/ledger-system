import type { InstitutionBalancesPage, SignedTotals } from "../dtos/LedgerReadModels";
import type { InstitutionBalancesPort } from "../ports/PayablesAgendaPort";
import { userActor, type AuditLog } from "../ports/AuditLog";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import type { BankStatement, BankStatementStore } from "../services/BankStatements";
import type { StartIntentUseCase } from "./StartIntent";
import type { ApplyAnswersUseCase } from "./ApplyAnswers";
import type { SubmitIntentUseCase } from "./SubmitIntent";
import { DialogEngine } from "../../domain/services/DialogEngine";
import { getScenario } from "../../domain/scenarios/Scenario";
import { institutionKeyOf, type Institution } from "../../domain/services/Institutions";
import { fromCents, toCents } from "../utils/cents";
import { localDay } from "../utils/instant";

/** A refusal the person can act on, in their language. */
export class InstitutionCashError extends Error {}

/** What the CFO informed for an institution, beside what the book said for the same day (REQ-675). */
export interface StatementCheck {
  day: string;
  amount: string;
  informedBy: string;
  informedAt: string;
  /** The book's balance at the end of that day. Null when no opening covered it: nothing to compare. */
  book: string | null;
  /** Statement − book. Null when the book's balance is unknown — never an invented difference. */
  difference: string | null;
}

export interface InstitutionView {
  key: string;
  name: string;
  /** False for an institution facts cite but `CASH_INSTITUTIONS` no longer lists. Kept: the facts stand. */
  configured: boolean;
  opening: { amount: string; day: string; eventId: string } | null;
  cashIn: string;
  cashOut: string;
  transfersIn: string;
  transfersOut: string;
  /** Null without an opening: unknown, never zero (REQ-673). */
  balance: string | null;
  statement: StatementCheck | null;
}

export type InstitutionsResult =
  | {
      available: true;
      asOf: string;
      institutions: InstitutionView[];
      known: { total: string; institutions: string[] };
      unknown: { since: string | null; cashIn: string; cashOut: string; count: number };
    }
  | { available: false };

export type RecordOutcome = { status: string; intentId: string; ledgerReference?: string; reason?: string };

const CURRENCY = "BRL";
const one = (totals: SignedTotals | null | undefined) => totals?.[CURRENCY] ?? "0.00";
/** A signed amount in the Ledger's form, for the comparison only: Treasury does not total (REQ-601). */
const signedCents = (amount: string) => (amount.startsWith("-") ? -toCents(amount.slice(1)) : toCents(amount));
const signed = (cents: bigint) => (cents < 0n ? `-${fromCents(-cents)}` : fromCents(cents));

/**
 * The money in each institution (§8.8): the balances the Ledger publishes, the opening balance and the
 * transfer that only the screen of institutions records, and the bank check.
 *
 * Every write goes through an intent, like any other (audit, author, Ledger outcome). The statement the
 * CFO informs is the one thing kept here and not in the Ledger: it is a control, not a fact (REQ-675).
 */
export class InstitutionCashUseCase {
  constructor(
    private readonly deps: {
      ledger: InstitutionBalancesPort;
      statements: BankStatementStore;
      audit: AuditLog;
      clock: Clock;
      ids: IdGenerator;
      startIntent: StartIntentUseCase;
      applyAnswers: ApplyAnswersUseCase;
      submit: SubmitIntentUseCase;
      institutions: Institution[];
      users?: { findById(id: string): Promise<{ displayName: string } | null> };
    },
  ) {}

  institutions(): Institution[] {
    return this.deps.institutions.map((i) => ({ ...i }));
  }

  async read(asOf?: string): Promise<InstitutionsResult> {
    let page: InstitutionBalancesPage;
    try {
      page = await this.deps.ledger.institutionBalances(asOf);
    } catch {
      return { available: false };
    }
    const statements = await this.deps.statements.latest();
    // The book on each statement's own day: one read per distinct day, never a balance carried over.
    const books = new Map<string, InstitutionBalancesPage | null>();
    for (const day of new Set(statements.map((s) => s.day))) {
      books.set(day, day === page.asOf ? page : await this.deps.ledger.institutionBalances(day).catch(() => null));
    }

    const byKey = new Map(page.institutions.map((i) => [institutionKeyOf(i.institution) ?? i.institution, i]));
    const keys = [...this.deps.institutions.map((i) => i.key), ...[...byKey.keys()].filter((k) => !this.deps.institutions.some((i) => i.key === k))];
    const nameOf = (key: string) => this.deps.institutions.find((i) => i.key === key)?.name ?? key;

    const institutions: InstitutionView[] = [];
    for (const key of keys) {
      const ledger = byKey.get(key);
      const statement = statements.find((s) => s.institution === key);
      institutions.push({
        key,
        name: nameOf(key),
        configured: this.deps.institutions.some((i) => i.key === key),
        opening: ledger?.opening ? { amount: ledger.opening.amount, day: ledger.opening.day, eventId: ledger.opening.eventId } : null,
        cashIn: one(ledger?.cashIn),
        cashOut: one(ledger?.cashOut),
        transfersIn: one(ledger?.transfersIn),
        transfersOut: one(ledger?.transfersOut),
        balance: ledger?.balance ? one(ledger.balance) : null,
        statement: statement ? await this.check(statement, key, books.get(statement.day) ?? null) : null,
      });
    }
    return {
      available: true,
      asOf: page.asOf,
      institutions,
      known: { total: one(page.known.total), institutions: page.known.institutions.map((id) => nameOf(institutionKeyOf(id) ?? id)) },
      unknown: { since: page.unknown.since, cashIn: one(page.unknown.cashIn), cashOut: one(page.unknown.cashOut), count: page.unknown.count },
    };
  }

  /** REQ-670: one standing opening per institution; a wrong one is corrected by rectification. */
  async registerOpening(input: { institution: string; amount: string; occurredAt: string; description?: string; by: string }): Promise<RecordOutcome> {
    const key = this.known(input.institution);
    const amount = input.amount?.trim() ?? "";
    if (!/^-?\d+(\.\d{1,2})?$/.test(amount) || signedCents(amount) === 0n) {
      throw new InstitutionCashError("Informe o saldo do extrato, diferente de zero; negativo se a conta estava no cheque especial.");
    }
    this.checkDate("register_opening_balance", input.occurredAt);
    let page: InstitutionBalancesPage;
    try {
      page = await this.deps.ledger.institutionBalances();
    } catch {
      throw new InstitutionCashError("O Ledger não respondeu; sem ele não dá para saber se já há abertura. Tente de novo.");
    }
    const standing = page.institutions.find((i) => institutionKeyOf(i.institution) === key)?.opening;
    if (standing) {
      throw new InstitutionCashError(
        `A abertura de ${this.nameOf(key)} já está registrada (${standing.day}, ${standing.amount}). Para corrigir, retifique esse lançamento.`,
      );
    }
    const overdrawn = amount.startsWith("-");
    return this.record("register_opening_balance", input.by, [
      { key: "institution", value: key },
      { key: "side", value: overdrawn ? "overdrawn" : "positive" },
      { key: "amount", value: overdrawn ? amount.slice(1) : amount },
      { key: "occurredAt", value: input.occurredAt },
      ...(input.description?.trim() ? [{ key: "description", value: input.description.trim() }] : []),
    ]);
  }

  /** REQ-672: one fact naming where the money left and where it arrived. */
  async registerTransfer(input: { from: string; to: string; amount: string; occurredAt: string; description?: string; by: string }): Promise<RecordOutcome> {
    const from = this.known(input.from);
    const to = this.known(input.to);
    if (from === to) throw new InstitutionCashError("A origem e o destino da transferência precisam ser instituições diferentes.");
    const amount = input.amount?.trim() ?? "";
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || toCents(amount) === 0n) throw new InstitutionCashError("Informe o valor transferido, maior que zero.");
    this.checkDate("register_institution_transfer", input.occurredAt);
    return this.record("register_institution_transfer", input.by, [
      { key: "fromInstitution", value: from },
      { key: "toInstitution", value: to },
      { key: "amount", value: amount },
      { key: "occurredAt", value: input.occurredAt },
      ...(input.description?.trim() ? [{ key: "description", value: input.description.trim() }] : []),
    ]);
  }

  /** REQ-675: the statement balance on a day — a control of the Treasury, audited, never a fact. */
  async informStatement(input: { institution: string; day: string; amount: string; by: string }): Promise<BankStatement> {
    const key = this.known(input.institution);
    const amount = input.amount?.trim() ?? "";
    if (!/^-?\d+(\.\d{1,2})?$/.test(amount)) throw new InstitutionCashError("Informe o saldo do extrato; negativo se a conta estava no cheque especial.");
    const today = localDay(this.deps.clock.now());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day ?? "") || Number.isNaN(Date.parse(`${input.day}T12:00:00Z`))) {
      throw new InstitutionCashError("Informe a data do extrato.");
    }
    if (input.day > today) throw new InstitutionCashError("O extrato não pode ser de um dia que ainda não terminou de chegar: a data está no futuro.");
    const statement: BankStatement = {
      id: this.deps.ids.next(),
      institution: key,
      day: input.day,
      amount: signed(signedCents(amount)),
      informedBy: input.by,
      informedAt: this.deps.clock.now(),
    };
    await this.deps.statements.add(statement);
    await this.deps.audit.record({
      actor: userActor(input.by),
      intentId: `extrato:${statement.id}`,
      at: statement.informedAt,
      type: "bank_statement_informed",
      detail: `${key} ${statement.day} ${statement.amount}`,
    });
    return statement;
  }

  async history(institution: string, limit = 20): Promise<StatementCheck[]> {
    const key = this.known(institution);
    const rows = await this.deps.statements.of(key, limit);
    const books = new Map<string, InstitutionBalancesPage | null>();
    const out: StatementCheck[] = [];
    for (const s of rows) {
      if (!books.has(s.day)) books.set(s.day, await this.deps.ledger.institutionBalances(s.day).catch(() => null));
      out.push(await this.check(s, key, books.get(s.day) ?? null));
    }
    return out;
  }

  private async check(s: BankStatement, key: string, book: InstitutionBalancesPage | null): Promise<StatementCheck> {
    const balance = book?.institutions.find((i) => institutionKeyOf(i.institution) === key)?.balance ?? null;
    const bookAmount = balance ? one(balance) : null;
    return {
      day: s.day,
      amount: s.amount,
      informedBy: (await this.deps.users?.findById(s.informedBy))?.displayName ?? s.informedBy,
      informedAt: s.informedAt,
      book: bookAmount,
      difference: bookAmount === null ? null : signed(signedCents(s.amount) - signedCents(bookAmount)),
    };
  }

  private async record(scenarioId: string, by: string, answers: { key: string; value: string }[]): Promise<RecordOutcome> {
    const { intentId } = await this.deps.startIntent.execute({ scenarioId, userId: by });
    const merged = await this.deps.applyAnswers.execute({ intentId, answers });
    if (merged.rejected.length > 0) throw new InstitutionCashError(merged.rejected.map((r) => r.message).join("; "));
    const outcome = await this.deps.submit.execute(intentId, by);
    return {
      status: outcome.intentStatus,
      intentId,
      ...(outcome.ledgerReference ? { ledgerReference: outcome.ledgerReference } : {}),
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    };
  }

  private checkDate(scenarioId: string, value: string): void {
    const slot = getScenario(scenarioId)!.slots.find((s) => s.key === "occurredAt")!;
    const problem = DialogEngine.validateAnswer(slot, value ?? "", localDay(this.deps.clock.now()));
    if (problem) throw new InstitutionCashError(`Data: ${problem.message}`);
  }

  private known(key: string): string {
    if (!this.deps.institutions.some((i) => i.key === key)) throw new InstitutionCashError(`Instituição desconhecida: ${key}.`);
    return key;
  }

  private nameOf(key: string): string {
    return this.deps.institutions.find((i) => i.key === key)?.name ?? key;
  }
}
