import { describe, it, expect } from "vitest";
import { pendingCorrection } from "../../../core/application/services/PendingCorrection";
import type { PositionLifecycle, PositionLifecycleEvent } from "../../../core/application/dtos/LedgerReadModels";

/**
 * A correction that was interrupted between its two events has to be visible and resumable — and
 * it has to be so WITHOUT treasury keeping a flag of its own. These tests pin that the pending state
 * is derived from the chain, and that it stops holding on its own the moment the reissue lands.
 */

const event = (over: Partial<PositionLifecycleEvent> = {}): PositionLifecycleEvent => ({
  eventId: "evt-1",
  eventType: "advance_payment",
  economicEffect: "cash_out",
  relation: "originates",
  amount: "400.00",
  currency: "BRL",
  occurredAt: "2026-07-01T00:00:00.000Z",
  recordedAt: "2026-07-01T00:00:00.000Z",
  description: null,
  relatedEventId: null,
  retracted: false,
  requiresFollowup: false,
  ...over,
});

const lifecycle = (events: PositionLifecycleEvent[]): PositionLifecycle => ({
  objectId: "intent:adv-1",
  objectType: "advance",
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "0.00",
  totalSettled: "0.00",
  openBalance: "0.00",
  eventCount: events.length,
  events,
});

const origination = event({ eventId: "evt-origin" });
const withdrawal = event({
  eventId: "evt-retract",
  eventType: "ledger_correction",
  economicEffect: "non_cash",
  relation: "retracts",
  relatedEventId: "evt-origin",
  requiresFollowup: true,
});

describe("pendingCorrection", () => {
  it("reports a withdrawal that declared a sequel and has not received one", () => {
    const pending = pendingCorrection(lifecycle([{ ...origination, retracted: true }, withdrawal]));

    expect(pending).toEqual({ retractionEventId: "evt-retract", targetEventId: "evt-origin" });
  });

  it("stops reporting it once the corrected entry lands — nothing is marked resolved", () => {
    const reissued = event({ eventId: "evt-reissue", amount: "450.00" });
    const pending = pendingCorrection(
      lifecycle([{ ...origination, retracted: true }, withdrawal, reissued]),
    );

    expect(pending).toBeNull();
  });

  it("ignores a withdrawal that was always meant to stand alone", () => {
    // No follow-up flag: this is the only thing treasury can offer for an entry it cannot record
    // again, and treating it as unfinished would nag forever about a completed decision.
    const alone = { ...withdrawal, requiresFollowup: false };
    expect(pendingCorrection(lifecycle([{ ...origination, retracted: true }, alone]))).toBeNull();
  });

  it("a later withdrawal does not count as the corrected entry", () => {
    const secondWithdrawal = event({
      eventId: "evt-retract-2",
      eventType: "ledger_correction",
      relation: "retracts",
      relatedEventId: "evt-other",
      requiresFollowup: false,
    });

    const pending = pendingCorrection(
      lifecycle([{ ...origination, retracted: true }, withdrawal, secondWithdrawal]),
    );

    expect(pending?.retractionEventId).toBe("evt-retract");
  });

  it("a withdrawal that was itself retracted no longer stands, so it is not pending", () => {
    const undone = { ...withdrawal, retracted: true };
    expect(pendingCorrection(lifecycle([origination, undone]))).toBeNull();
  });

  it("a position with no correction at all reports nothing", () => {
    expect(pendingCorrection(lifecycle([origination]))).toBeNull();
  });

  it("reports the most recent unfinished correction when a position has had several", () => {
    const firstReissue = event({ eventId: "evt-reissue-1", amount: "450.00" });
    const secondWithdrawal = event({
      eventId: "evt-retract-2",
      eventType: "ledger_correction",
      relation: "retracts",
      relatedEventId: "evt-reissue-1",
      requiresFollowup: true,
    });

    const pending = pendingCorrection(
      lifecycle([
        { ...origination, retracted: true },
        withdrawal,
        { ...firstReissue, retracted: true },
        secondWithdrawal,
      ]),
    );

    expect(pending).toEqual({ retractionEventId: "evt-retract-2", targetEventId: "evt-reissue-1" });
  });
});
