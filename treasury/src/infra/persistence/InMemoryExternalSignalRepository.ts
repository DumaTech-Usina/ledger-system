import { ExternalSignal, type ExternalSignalProps } from "../../core/domain/entities/ExternalSignal";
import type { ExternalSignalRepository } from "../../core/application/repositories/ExternalSignalRepository";

export class InMemoryExternalSignalRepository implements ExternalSignalRepository {
  private readonly store: ExternalSignalProps[] = [];

  async add(signal: ExternalSignal): Promise<void> {
    if (this.store.some((s) => s.id === signal.id)) throw new Error(`Signal ${signal.id} already recorded.`);
    this.store.push(signal.toJSON());
  }

  async latestFor(kind: string, recordId: string): Promise<ExternalSignal | null> {
    const found = [...this.store].reverse().find((p) => p.kind === kind && p.recordId === recordId);
    return found ? ExternalSignal.rehydrate(found) : null;
  }

  async list(): Promise<ExternalSignal[]> {
    return [...this.store].reverse().map((p) => ExternalSignal.rehydrate(p));
  }

  async listPage({ before, limit }: { before?: string; limit: number }): Promise<{ signal: ExternalSignal; cursor: string }[]> {
    const after = before === undefined ? this.store.length : Number(before);
    if (!Number.isFinite(after)) return [];
    const page: { signal: ExternalSignal; cursor: string }[] = [];
    for (let i = Math.min(after, this.store.length) - 1; i >= 0 && page.length < limit; i--) {
      page.push({ signal: ExternalSignal.rehydrate(this.store[i]), cursor: String(i) });
    }
    return page;
  }
}
