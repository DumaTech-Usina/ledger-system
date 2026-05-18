import { EnrichedReceiptInput } from "../dtos/EnrichedReceiptInput";

export interface ReceiptETLReader {
  /** Streams receipts pre-joined with their proposal context via a server-side $lookup cursor.
   *  Receipts with no matching clean proposal are dropped at the database level.
   *  Node never holds the full proposals dataset in memory. */
  streamEnrichedReceipts(): AsyncIterable<EnrichedReceiptInput>;
}
