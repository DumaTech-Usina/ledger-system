export interface StagingRecord {
  id: string;
  status: "pending" | "processing" | "queued" | "accepted" | "rejected";

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
  previousHash?: string | null;

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

/** Narrowed view of StagingRecord after all required fields have been validated present. */
export type ValidatedStagingRecord = Omit<
  StagingRecord,
  'eventType' | 'economicEffect' | 'occurredAt' | 'amount' | 'currency' |
  'sourceSystem' | 'sourceReference' | 'normalizationVersion' | 'normalizationWorkerId' |
  'parties' | 'objects' | 'reporter' | 'reason'
> & {
  eventType: string;
  economicEffect: string;
  occurredAt: string;
  amount: string;
  currency: string;
  sourceSystem: string;
  sourceReference: string;
  normalizationVersion: string;
  normalizationWorkerId: string;
  parties: Array<{
    partyId: string;
    role?: string;
    direction?: string;
    amount?: string;
  }>;
  objects: Array<{
    objectId: string;
    objectType?: string;
    relation?: string;
  }>;
  reporter: {
    reporterType: string;
    reporterId: string;
    reporterName?: string | null;
    channel: string;
  };
  reason?: {
    type: string;
    description: string;
    confidence: string;
    requiresFollowup?: boolean;
  } | null;
};
