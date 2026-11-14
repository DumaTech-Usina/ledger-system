import type { PayablesAgendaPage, PayablesAgendaQuery, ReceivablesAgendaPage, ReceivablesAgendaQuery } from "../dtos/LedgerReadModels";

/** Read-only: the Ledger's agenda of what the Usina owes, by due window (§8.5). */
export interface PayablesAgendaPort {
  payablesAgenda(query: PayablesAgendaQuery): Promise<PayablesAgendaPage>;
}

/** Read-only: the Ledger's agenda of what is owed to the Usina, by expected date and payer (§8.7). */
export interface ReceivablesAgendaPort {
  receivablesAgenda(query: ReceivablesAgendaQuery): Promise<ReceivablesAgendaPage>;
}
