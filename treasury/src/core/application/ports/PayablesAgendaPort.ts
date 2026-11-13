import type { PayablesAgendaPage, PayablesAgendaQuery } from "../dtos/LedgerReadModels";

/** Read-only: the Ledger's agenda of what the Usina owes, by due window (§8.5). */
export interface PayablesAgendaPort {
  payablesAgenda(query: PayablesAgendaQuery): Promise<PayablesAgendaPage>;
}
