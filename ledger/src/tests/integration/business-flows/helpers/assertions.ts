import { expect } from "vitest";
import { InMemoryLedgerEventRepository } from "../../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { EventType } from "../../../../core/domain/enums/EventType";

export async function assertChain(ledgerRepo: InMemoryLedgerEventRepository) {
  const events = await ledgerRepo.findAll();
  for (let i = 1; i < events.length; i++) {
    expect(events[i].previousHash?.value, `chain broken at index ${i}`).toBe(
      events[i - 1].hash.value,
    );
  }
}

export async function lifecycleOf(
  ledgerRepo: InMemoryLedgerEventRepository,
  objectId: string,
): Promise<EventType[]> {
  const events = await ledgerRepo.findByObjectId(objectId);
  return events.map((e) => e.eventType);
}
