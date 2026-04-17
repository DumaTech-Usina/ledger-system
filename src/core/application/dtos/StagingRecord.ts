export interface StagingRecord {
  id: string;
  status: "pending" | "processing" | "accepted" | "rejected";

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

  relatedEventId?: string | null;

  parties?: Array<{
    partyId?: string;
    role?: string;
    direction?: string;
    amount?: string;
  }>;

  objects?: Array<{
    objectId?: string;
    objectType?: string;
    relation?: string;
  }>;

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
