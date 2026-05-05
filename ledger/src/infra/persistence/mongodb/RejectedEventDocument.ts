/**
 * MongoDB document shape for a rejected event.
 *
 * Reasons are embedded directly — no separate collection needed.
 * _id maps to RejectedEvent.id.value.
 */
export interface RejectedEventDocument {
  _id: string;
  stagingId: string;
  rejectedAt: Date;
  rawPayload: unknown | null;
  reasons: Array<{
    type: string;
    description: string;
  }>;
}
