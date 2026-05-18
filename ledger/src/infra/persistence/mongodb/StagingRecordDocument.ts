import { StagingRecord } from '../../../core/application/dtos/StagingRecord';

export type StagingRecordDocument =
  Omit<StagingRecord, 'id' | 'parties' | 'objects'> & {
    _id: string;
    parties?: StagingRecord['parties'] | null;
    objects?: StagingRecord['objects'] | null;
  };
