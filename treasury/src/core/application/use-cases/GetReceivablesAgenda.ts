import type { ReceivablesAgendaPort } from "../ports/PayablesAgendaPort";
import type { PositionsQuery } from "../ports/LedgerReadPort";
import type {
  AgendaSummary,
  AgendaWindow,
  PositionItem,
  PositionsPage,
  ReceivablesAgendaList,
  ReceivablesAgendaQuery,
} from "../dtos/LedgerReadModels";
import type { ExternalSignalRepository } from "../repositories/ExternalSignalRepository";
import type { Party } from "../../domain/entities/Party";
import { toCents } from "../utils/cents";

/** What the insurer declared it paid for one policy, in its most recent eligibility reading (REQ-263). */
export interface InsurerClaim {
  policyId: string;
  /** The number the insurance system shows, when it has one; otherwise the id. */
  policyLabel: string;
  claimed: string;
  eligibleAt: string | null;
  /** The insurer's name as the signal saw it. */
  insurer: string | null;
}

export interface ReceivableLine extends PositionItem {
  /** Who owes it: every party but the Usina, by name when the Directory knows it. Empty = not stated. */
  payers: { partyId: string; displayName: string }[];
  /** Days since the position was opened, in São Paulo days. Null when the date is unknown. */
  openForDays: number | null;
  /** Something already came in: what is open is less than what was expected. */
  partiallyReceived: boolean;
  /** The policy the expected commission came from, when it came from the insurance system. */
  policyId: string | null;
  /** REQ-663: the insurer says it paid, and the Ledger has not seen that much come in. */
  declared: InsurerClaim | null;
}

export interface PayerGroup extends AgendaSummary {
  key: string;
  payers: { partyId: string; displayName: string }[];
}

export type ReceivablesAgendaResult =
  | {
      available: true;
      asOf: string;
      windowDays: number;
      windows: Record<AgendaWindow, AgendaSummary>;
      unlinked: AgendaSummary;
      payers: PayerGroup[];
      payer: string | null;
      window: ReceivablesAgendaList;
      lines: ReceivableLine[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  | { available: false };

/** One expected commission the insurer declared paid and the bank has not shown (REQ-663). */
export interface DeclaredLine extends InsurerClaim {
  objectId: string;
  received: string;
  open: string | null;
  dueAt: string | null;
  currency: string;
  payerKey: string;
  payers: { partyId: string; displayName: string }[];
}

export type DeclaredResult = { available: true; lines: DeclaredLine[] } | { available: false };

const ZONE = "America/Sao_Paulo";
const dayIn = (instant: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
const daysBetween = (fromYmd: string, toYmd: string) => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);

/** The expected commission a policy's signal proposes (REQ-265). */
const POLICY_POSITION = /^seguro:apolice:(.+):prevista$/;

/** Bounds the walk over the open expected commissions: 200 a page. */
const MAX_PAGES = 100;

/**
 * The agenda of what is owed to the Usina (§8.7). Shows what the Ledger published — windows, totals,
 * payers, receipts with no origin — and adds only what the Treasury knows: who each payer is, how long
 * a line has been open, and what the insurer declared it paid (REQ-663), which is a signal and never a
 * receipt. It never adds money up (REQ-601); when the Ledger cannot answer, it is unavailable.
 */
export class GetReceivablesAgendaUseCase {
  constructor(
    private readonly ledger: ReceivablesAgendaPort & { positions(params?: PositionsQuery): Promise<PositionsPage> },
    private readonly signals: ExternalSignalRepository,
    private readonly directory: { list(): Promise<Party[]> },
    private readonly usinaPartyId: string,
  ) {}

  async execute(query: ReceivablesAgendaQuery): Promise<ReceivablesAgendaResult> {
    let page;
    try {
      page = await this.ledger.receivablesAgenda(query);
    } catch {
      return { available: false };
    }
    const [named, claims] = await Promise.all([this.names(), this.claims()]);
    const lines: ReceivableLine[] = page.data.map((p) => {
      const opened = p.originatedAt ?? p.createdAt;
      return {
        ...p,
        payers: this.payersOf(p.parties ?? [], named),
        openForDays: opened ? daysBetween(dayIn(opened), page.asOf) : null,
        partiallyReceived: p.openBalance !== null && toCents(p.openBalance) < toCents(p.totalOriginated),
        policyId: POLICY_POSITION.exec(p.objectId)?.[1] ?? null,
        declared: unseenClaim(p, claims),
      };
    });
    return {
      available: true,
      asOf: page.asOf,
      windowDays: page.windowDays,
      windows: page.windows,
      unlinked: page.unlinked,
      payers: page.payers.map((g) => ({ key: g.key, count: g.count, totals: g.totals, payers: this.payersOf(g.partyIds, named) })),
      payer: page.payer,
      window: page.window,
      lines,
      total: page.total,
      page: page.page,
      limit: page.limit,
      totalPages: page.totalPages,
    };
  }

  /**
   * REQ-663: every open expected commission whose policy the insurer declared paid, with less received
   * than declared. Oldest declaration first: the longest wait is the first to chase. Each line carries
   * its own figures; nothing is totalled here (REQ-601).
   */
  async declared(): Promise<DeclaredResult> {
    const claims = await this.claims();
    if (claims.size === 0) {
      // Nothing declared: no need to ask the Ledger anything, but say so only if it is there.
      try {
        await this.ledger.positions({ objectType: "commission_receivable", status: ["open", "partially_settled"], limit: 1 });
      } catch {
        return { available: false };
      }
      return { available: true, lines: [] };
    }
    const named = await this.names();
    const lines: DeclaredLine[] = [];
    try {
      for (let n = 1; n <= MAX_PAGES; n++) {
        const page = await this.ledger.positions({
          objectType: "commission_receivable",
          status: ["open", "partially_settled"],
          limit: 200,
          page: n,
        });
        for (const p of page.data) {
          const claim = unseenClaim(p, claims);
          if (!claim) continue;
          const parties = p.parties ?? [];
          lines.push({
            ...claim,
            objectId: p.objectId,
            received: p.totalSettled!,
            open: p.openBalance,
            dueAt: p.dueAt,
            currency: p.currency,
            payerKey: [...new Set(parties.filter((id) => id !== this.usinaPartyId))].sort().join(","),
            payers: this.payersOf(parties, named),
          });
        }
        if (n >= page.totalPages) break;
      }
    } catch {
      return { available: false };
    }
    lines.sort((a, b) => (a.eligibleAt ?? "").localeCompare(b.eligibleAt ?? "") || a.objectId.localeCompare(b.objectId));
    return { available: true, lines };
  }

  private payersOf(partyIds: readonly string[], named: Map<string, string>) {
    return [...new Set(partyIds)]
      .filter((id) => id !== this.usinaPartyId)
      .sort()
      .map((partyId) => ({ partyId, displayName: named.get(partyId) ?? partyId }));
  }

  private async names(): Promise<Map<string, string>> {
    return new Map((await this.directory.list()).map((p) => [p.partyId, p.displayName]));
  }

  /** The most recent eligibility reading of each policy: what the insurer says it paid. */
  private async claims(): Promise<Map<string, InsurerClaim>> {
    const claims = new Map<string, InsurerClaim>();
    for (const signal of await this.signals.list()) {
      if (signal.kind !== "eligibility" || claims.has(signal.recordId)) continue;
      const { fields } = signal.toJSON();
      if (!fields.usinaValue) continue;
      claims.set(signal.recordId, {
        policyId: signal.recordId,
        policyLabel: fields.policyNumber ?? signal.recordId,
        claimed: fields.usinaValue,
        eligibleAt: fields.eligibleAt ?? null,
        insurer: fields.insurer ?? null,
      });
    }
    return claims;
  }
}

/**
 * The claim on this position, when the Ledger has seen less come in than the insurer declared.
 * Without the settled figure the comparison cannot be made, and nothing is marked: unknown, not unseen.
 */
function unseenClaim(p: PositionItem, claims: Map<string, InsurerClaim>): InsurerClaim | null {
  const policyId = POLICY_POSITION.exec(p.objectId)?.[1];
  const claim = policyId ? claims.get(policyId) : undefined;
  if (!claim || p.totalSettled === undefined) return null;
  try {
    return toCents(p.totalSettled) < toCents(claim.claimed) ? claim : null;
  } catch {
    // A declared value the insurance system wrote in some other form cannot be compared: not marked.
    return null;
  }
}
