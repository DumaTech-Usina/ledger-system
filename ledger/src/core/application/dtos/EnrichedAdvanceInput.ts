/** An advance report pre-joined with its validation status from aspirant_advance_canonical.
 *  Only CLEAN records reach this type — filtering is applied server-side in the reader. */
export interface EnrichedAdvanceInput {
  advanceReportId: string;
  amountToPay: number;
  brokerId: string;
  isPaid: boolean;
  isCancelled: boolean;
  createdAt: Date;
}
