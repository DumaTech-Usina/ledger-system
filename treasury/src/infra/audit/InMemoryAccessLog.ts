import type { AccessLog, AccessLogEntry } from "../../core/application/ports/AccessLog";

/** The record of user management, in memory, for tests. */
export class InMemoryAccessLog implements AccessLog {
  private readonly entries: AccessLogEntry[] = [];

  async append(entry: AccessLogEntry): Promise<void> {
    this.entries.push({ ...entry });
  }

  async list(): Promise<AccessLogEntry[]> {
    return this.entries.map((e) => ({ ...e }));
  }
}
