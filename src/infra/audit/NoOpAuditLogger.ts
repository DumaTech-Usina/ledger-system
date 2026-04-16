import { AuditEntry, IAuditLogger } from "../../core/application/services/IAuditLogger";

export class NoOpAuditLogger implements IAuditLogger {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async log(_entry: AuditEntry): Promise<void> {}
}
