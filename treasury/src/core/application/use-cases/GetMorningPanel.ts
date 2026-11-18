import type { AgendaDay, AgendaSummary, PayablesAgendaPage, ReceivablesAgendaPage } from "../dtos/LedgerReadModels";
import type { PayablesAgendaPort, ReceivablesAgendaPort } from "../ports/PayablesAgendaPort";
import type { InstitutionCashUseCase, InstitutionsResult } from "./InstitutionCash";

/** One side of the morning panel — what falls due, or what is expected — in the agenda's own columns. */
export interface MorningColumns {
  overdue: AgendaSummary;
  /** Today and each next day of the window, in order. */
  days: AgendaDay[];
  /** After the window: shown apart, never in a day. */
  later: AgendaSummary;
  /** No date at all: shown apart, never in a day (REQ-641, REQ-661). */
  undated: AgendaSummary;
}

export type MorningPanelResult =
  | {
      available: true;
      asOf: string;
      windowDays: number;
      cash: {
        institutions: { key: string; name: string; balance: string | null }[];
        known: { total: string; institutions: string[] };
        /** Configured institutions with no opening: their balance is unknown and out of the total (REQ-681). */
        missingOpening: string[];
        unknown: { since: string | null; cashIn: string; cashOut: string; count: number };
      };
      payables: MorningColumns;
      receivables: MorningColumns;
    }
  | { available: false };

const columns = (page: PayablesAgendaPage | ReceivablesAgendaPage): MorningColumns => ({
  overdue: page.windows.overdue,
  days: page.days ?? [],
  later: page.windows.later,
  undated: page.windows.undated,
});

/**
 * The morning panel (§8.10, E7): "does the known cash cover what falls due?", answered by putting the
 * Ledger's own figures side by side — the balance of each institution, what falls due day by day, and,
 * apart, what is expected to come in. Read for today, whatever period the page below shows (REQ-680).
 *
 * Nothing is added, netted or concluded here (REQ-684): the Treasury does not sum money (REQ-601), and
 * a "surplus" computed from a cash that may be incomplete would say more than the book knows. When the
 * Ledger cannot answer, the whole panel is unavailable — never zeros (REQ-685).
 */
export class GetMorningPanelUseCase {
  constructor(
    private readonly agendas: PayablesAgendaPort & ReceivablesAgendaPort,
    private readonly cash: Pick<InstitutionCashUseCase, "read">,
  ) {}

  async execute(): Promise<MorningPanelResult> {
    let payables: PayablesAgendaPage;
    let receivables: ReceivablesAgendaPage;
    let balances: InstitutionsResult;
    try {
      // `limit: 1`: the panel needs the totals, which cover every position; the lines are not shown.
      [payables, receivables, balances] = await Promise.all([
        this.agendas.payablesAgenda({ limit: 1 }),
        this.agendas.receivablesAgenda({ limit: 1 }),
        this.cash.read(),
      ]);
    } catch {
      return { available: false };
    }
    if (!balances.available) return { available: false };

    return {
      available: true,
      asOf: payables.asOf,
      windowDays: payables.windowDays,
      cash: {
        institutions: balances.institutions.map((i) => ({ key: i.key, name: i.name, balance: i.balance })),
        known: balances.known,
        missingOpening: balances.institutions.filter((i) => i.configured && i.balance === null).map((i) => i.name),
        unknown: balances.unknown,
      },
      payables: columns(payables),
      receivables: columns(receivables),
    };
  }
}
