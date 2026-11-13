import type { PayablesAgendaPort } from "../ports/PayablesAgendaPort";
import type { AgendaWindow, PayablesAgendaQuery, PositionItem } from "../dtos/LedgerReadModels";
import type { Party } from "../../domain/entities/Party";

export interface AgendaLine extends PositionItem {
  /** Who the Usina owes: every party of the position but the Usina, by name when the Directory knows it. */
  creditors: { partyId: string; displayName: string }[];
  /** Days since the position was opened, counted in São Paulo days (REQ-643). Null when the date is unknown. */
  openForDays: number | null;
  /** Something was already paid: what is open is less than what was owed (REQ-644). */
  partiallyPaid: boolean;
}

export type PayablesAgendaResult =
  | {
      available: true;
      asOf: string;
      windowDays: number;
      windows: Record<AgendaWindow, { count: number; totals: Record<string, string> }>;
      window: AgendaWindow;
      lines: AgendaLine[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  | { available: false };

const ZONE = "America/Sao_Paulo";
const dayIn = (instant: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
const daysBetween = (fromYmd: string, toYmd: string) => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);

/**
 * The agenda of what the Usina owes (§8.5). Shows what the Ledger published — windows, totals and
 * lines — and adds only what the Treasury knows: who each creditor is and how long a line has been
 * open. It never adds money up (REQ-601, REQ-642), and when the Ledger cannot answer, the agenda is
 * unavailable, never an empty list or a zero total (REQ-645).
 */
export class GetPayablesAgendaUseCase {
  constructor(
    private readonly ledger: PayablesAgendaPort,
    private readonly directory: { list(): Promise<Party[]> },
    private readonly usinaPartyId: string,
  ) {}

  async execute(query: PayablesAgendaQuery): Promise<PayablesAgendaResult> {
    let page;
    try {
      page = await this.ledger.payablesAgenda(query);
    } catch {
      return { available: false };
    }
    const names = new Map((await this.directory.list()).map((p) => [p.partyId, p.displayName]));
    const lines: AgendaLine[] = page.data.map((p) => {
      const opened = p.originatedAt ?? p.createdAt;
      return {
        ...p,
        creditors: (p.parties ?? [])
          .filter((id) => id !== this.usinaPartyId)
          .map((partyId) => ({ partyId, displayName: names.get(partyId) ?? partyId })),
        openForDays: opened ? daysBetween(dayIn(opened), page.asOf) : null,
        partiallyPaid: p.openBalance !== null && Number(p.openBalance) < Number(p.totalOriginated),
      };
    });
    return {
      available: true,
      asOf: page.asOf,
      windowDays: page.windowDays,
      windows: page.windows,
      window: page.window,
      lines,
      total: page.total,
      page: page.page,
      limit: page.limit,
      totalPages: page.totalPages,
    };
  }
}
