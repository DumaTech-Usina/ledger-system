import * as fs from "fs";
import * as path from "path";
import { AuditEntry, IAuditLogger } from "../../core/application/services/IAuditLogger";

export class FileAuditLogger implements IAuditLogger {
  constructor(private readonly logDir: string) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {
      // Directory already exists or creation failed — handled per-write
    }
  }

  async log(entry: AuditEntry): Promise<void> {
    const filePath = path.join(this.logDir, `${this.today()}.log`);
    const line = JSON.stringify(entry) + "\n";

    try {
      fs.appendFileSync(filePath, line, "utf8");
    } catch (err) {
      // Never block the caller — emit to stderr and move on
      process.stderr.write(
        `[FileAuditLogger] Failed to write audit entry: ${String(err)}\n`,
      );
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }
}
