import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { CashPosition, CashMovement, PositionItem } from "../dtos/LedgerReadModels";
import { computeClassificationHealth, type ClassificationHealth } from "../services/classificationHealth";

/** Positions fetched to compute the classification-health signal; the table shows a small slice. */
const HEALTH_SCAN_LIMIT = 500;
const DISPLAY_POSITIONS = 8;

export interface TreasuryDashboard {
  /** False when the Ledger could not be reached — the UI shows an unavailable notice. */
  available: boolean;
  cashPosition: CashPosition | null;
  movements: CashMovement[] | null;
  positions: PositionItem[] | null;
  /** Generic/uncategorized-payment governance signal; null when the Ledger is unreachable. */
  classificationHealth: ClassificationHealth | null;
  /**
   * partyId → display name, for the counterparties appearing in `movements`. Kept BESIDE the
   * movements rather than inside them — the same separation `PreviewIntentResult.partyNames` makes,
   * and for the same reason: a CashMovement mirrors what the Ledger published, and the Ledger
   * publishes ids. A name is treasury's own knowledge and does not belong in that mirror.
   *
   * A party the Directory does not know is simply absent here, so the id stays on screen. An
   * invented label would be a claim treasury cannot support.
   */
  partyNames: Record<string, string>;
}

/**
 * Composes the treasury dashboard from Ledger reads. If the Ledger is unreachable, degrades to an
 * `available: false` payload instead of failing — the User App must tolerate the Ledger being down.
 */
export class GetTreasuryDashboardUseCase {
  constructor(
    private readonly ledger: LedgerReadPort,
    private readonly usinaPartyId: string,
    private readonly directory: PartyDirectoryPort,
  ) {}

  async execute(): Promise<TreasuryDashboard> {
    try {
      const [cashPosition, movements, positions] = await Promise.all([
        this.ledger.cashPosition(),
        this.ledger.cashMovements({ partyId: this.usinaPartyId, limit: 8 }),
        this.ledger.positions({ limit: HEALTH_SCAN_LIMIT }),
      ]);
      const classificationHealth = computeClassificationHealth(positions.data, positions.total, new Date());
      return {
        available: true,
        cashPosition,
        movements: movements.items,
        positions: positions.data.slice(0, DISPLAY_POSITIONS),
        classificationHealth,
        partyNames: await this.nameCounterparties(movements.items),
      };
    } catch {
      return {
        available: false,
        cashPosition: null,
        movements: null,
        positions: null,
        classificationHealth: null,
        partyNames: {},
      };
    }
  }

  /**
   * Looks up a display name for each counterparty on screen. Deliberately outside the failure path
   * above: a Directory that is down does not make the Ledger's figures unavailable, so it degrades
   * to ids rather than taking the whole dashboard with it. Names are legibility, not truth.
   */
  private async nameCounterparties(movements: CashMovement[]): Promise<Record<string, string>> {
    const ids = [...new Set(movements.map((m) => m.counterparty).filter((id): id is string => id !== null))];
    if (ids.length === 0) return {};

    try {
      const parties = await Promise.all(ids.map((id) => this.directory.get(id)));
      const names: Record<string, string> = {};
      for (const party of parties) {
        if (party) names[party.partyId] = party.displayName;
      }
      return names;
    } catch {
      return {};
    }
  }
}
