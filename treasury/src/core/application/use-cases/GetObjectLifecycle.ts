import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";
import type { PositionLifecycle } from "../dtos/LedgerReadModels";

/**
 * Shows how one economic object evolved: originated, then settled — fully, partially, or at a loss.
 * The Ledger owns that projection; this only asks for it. `null` when the object is unknown, which
 * is a legitimate state (Treasury never asserts that an absent object never existed).
 */
export class GetObjectLifecycleUseCase {
  constructor(private readonly ledger: PositionLifecyclePort) {}

  execute(objectId: string): Promise<PositionLifecycle | null> {
    return this.ledger.lifecycle(objectId);
  }
}
