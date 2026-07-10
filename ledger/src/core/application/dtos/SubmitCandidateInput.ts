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
  amount: string;
  currency: string;
  description?: string | null;
  parties: { partyId: string; role: string; direction: string; amount?: string }[];
  objects: { objectId: string; objectType: string; relation: string }[];
  reason?: { type: string; description: string; confidence: string; requiresFollowup: boolean } | null;
  reporter: { reporterType: string; reporterId: string; reporterName?: string | null; channel: string };
}
