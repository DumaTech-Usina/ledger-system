import { CreateLedgerEventUseCase } from "../../../../core/application/use-cases/CreateLedgerEventUseCase";
import { CreateLedgerEventCommand } from "../../../../core/application/dtos/CreateLedgerEventInput";
import { InMemoryLedgerEventRepository } from "../../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { NoOpAuditLogger } from "../../../../infra/audit/NoOpAuditLogger";

export function setup() {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
  const run = (cmd: CreateLedgerEventCommand) => useCase.execute(cmd);
  return { ledgerRepo, run };
}
