import type { LedgerReadPort } from "../ports/LedgerReadPort";
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
}

/**
 * Composes the treasury dashboard from Ledger reads. If the Ledger is unreachable, degrades to an
 * `available: false` payload instead of failing — the User App must tolerate the Ledger being down.
 */
export class GetTreasuryDashboardUseCase {
  constructor(
    private readonly ledger: LedgerReadPort,
    private readonly usinaPartyId: string,
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
      };
    } catch {
      return { available: false, cashPosition: null, movements: null, positions: null, classificationHealth: null };
    }
  }
}
