import { ExternalSignal, type ExternalSignalProps } from "../../core/domain/entities/ExternalSignal";
import type { ExternalSignalRepository } from "../../core/application/repositories/ExternalSignalRepository";

export class InMemoryExternalSignalRepository implements ExternalSignalRepository {
  private readonly store: ExternalSignalProps[] = [];

  async add(signal: ExternalSignal): Promise<void> {
    if (this.store.some((s) => s.id === signal.id)) throw new Error(`Signal ${signal.id} already recorded.`);
    this.store.push(signal.toJSON());
  }

  async list(): Promise<ExternalSignal[]> {
    return [...this.store].reverse().map((p) => ExternalSignal.rehydrate(p));
  }
}
