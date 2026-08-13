import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { BookExposure } from "../dtos/LedgerReadModels";

export interface BookExposureResult {
  /** False when the Ledger could not be reached — the UI shows an unavailable notice. */
  available: boolean;
  exposure: BookExposure | null;
}

/**
 * What the position math says about the whole book: how much is outstanding, how much of it has sat
 * untouched long enough to be at risk, and how well the book has been closing.
 *
 * Kept apart from {@link GetTreasuryDashboardUseCase} on purpose. That one answers "how much money
 * moved" — a fold over `economicEffect` that never reads an object. This one answers "what is the
 * economic situation" — a fold over `relation`, grouped by object. Composing both into one payload
 * is what put a position figure next to three cash figures on the same row, which is the confusion
 * this separation removes.
 *
 * Degrades like the dashboard rather than failing: an unreachable Ledger means the figures are
 * unknown, and unknown is reported as unavailable — never as zero exposure, which would read as a
 * healthy book.
 */
export interface BookExposureInput {
  /** ISO dates. Scope the Ledger's period cash figures only — the exposure totals are current-state. */
  from?: string;
  to?: string;
}

export class GetBookExposureUseCase {
  constructor(private readonly ledger: LedgerReadPort) {}

  async execute(input: BookExposureInput = {}): Promise<BookExposureResult> {
    try {
      return { available: true, exposure: await this.ledger.bookExposure(input) };
    } catch {
      return { available: false, exposure: null };
    }
  }
}
