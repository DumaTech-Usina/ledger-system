import type { CashPosition, CashMovementsPage, PositionsPage } from "../dtos/LedgerReadModels";

/**
 * Read-only boundary to the Ledger's financial truth. The concrete adapter talks HTTP to the
 * Ledger's published read API. treasury never writes through this and never recomputes figures.
 */
export interface LedgerReadPort {
  cashPosition(): Promise<CashPosition>;
  /** `from`/`to` are inclusive ISO date-only bounds ("yyyy-mm-dd") matched against occurredAt's date. */
  cashMovements(params: { partyId: string; limit?: number; from?: string; to?: string }): Promise<CashMovementsPage>;
  /** `asOf` restricts to positions whose lastEventAt falls on or before that ISO date. */
  positions(params?: { limit?: number; asOf?: string }): Promise<PositionsPage>;
}
