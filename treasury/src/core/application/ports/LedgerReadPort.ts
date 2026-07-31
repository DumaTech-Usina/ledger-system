import type { CashPosition, CashMovementsPage, PositionsPage } from "../dtos/LedgerReadModels";

/**
 * Read-only boundary to the Ledger's financial truth. The concrete adapter talks HTTP to the
 * Ledger's published read API. treasury never writes through this and never recomputes figures.
 */
export interface LedgerReadPort {
  cashPosition(): Promise<CashPosition>;
  cashMovements(params: { partyId: string; limit?: number }): Promise<CashMovementsPage>;
  positions(params?: { limit?: number }): Promise<PositionsPage>;
}
