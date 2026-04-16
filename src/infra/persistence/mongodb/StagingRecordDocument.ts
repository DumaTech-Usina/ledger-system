/**
 * MongoDB document shape for a staging record.
 *
 * Mirrors the StagingRecord DTO almost 1:1.
 * _id maps to StagingRecord.id.
 */
export interface StagingRecordDocument {
  _id: string;
  status: 'pending' | 'processed';

  eventType?: string;
  economicEffect?: string;

  occurredAt?: string;
  sourceAt?: string | null;

  amount?: string;
  currency?: string;

  description?: string | null;

  sourceSystem?: string;
  sourceReference?: string;

  normalizationVersion?: string;
  normalizationWorkerId?: string;

  previousHash?: string | null;

  parties?: Array<{
    partyId?: string;
    role?: string;
    direction?: string;
    amount?: string;
  }> | null;

  objects?: Array<{
    objectId?: string;
    objectType?: string;
    relation?: string;
  }> | null;

  reason?: {
    type?: string;
    description?: string;
    confidence?: string;
    requiresFollowup?: boolean;
  } | null;

  reporter?: {
    reporterType?: string;
    reporterId?: string;
    reporterName?: string | null;
    channel?: string;
  };
}
