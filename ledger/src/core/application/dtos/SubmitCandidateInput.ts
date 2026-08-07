/**
 * The candidate payload the User App (Treasury) POSTs to /api/intents/submit. Values arrive as
 * strings over the wire; the Ledger validates them (StagingRecordValidator) and enriches with its
 * own ingestion metadata (sourceSystem, normalization) before creating the event. This is the
 * Ledger side of the User App ↔ Ledger integration contract (option B interim: canonical candidate).
 */
export interface SubmitCandidateInput {
  sourceReference: string;
  eventType: string;
  economicEffect: string;
  occurredAt: string;
  sourceAt?: string | null;
  /**
   * When the obligation this candidate originates falls due, as the establishing document stated it
   * (ISO date). Only `obligation_recognized` admits it, and only alongside an ORIGINATES — the
   * invariant refuses it anywhere else rather than dropping it silently. Absent means the terms were
   * not stated, which the projection reports as unknown; nothing is derived from `occurredAt`.
   */
  dueAt?: string | null;
  amount: string;
  currency: string;
  description?: string | null;
  /**
   * Causal origin link. When present, the Ledger validates it (existence + allowedOriginTypes +
   * over-settlement). Absent/null is a valid orphan when the event declares its lineage unresolved
   * (reason UNKNOWN_ORIGIN + requiresFollowup) — the Ledger never fabricates an origin.
   */
  relatedEventId?: string | null;
  parties: { partyId: string; role: string; direction: string; amount?: string }[];
  objects: { objectId: string; objectType: string; relation: string }[];
  reason?: { type: string; description: string; confidence: string; requiresFollowup: boolean } | null;
  reporter: { reporterType: string; reporterId: string; reporterName?: string | null; channel: string };
}
