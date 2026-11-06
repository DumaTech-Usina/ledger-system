import type { IntentStatus } from "../enums/IntentStatus";

/** §11.1: an intent that was sent, accepted or refused takes no more edits. */
export class IntentNotEditableError extends Error {
  constructor(intentId: string, status: IntentStatus) {
    super(`Intent ${intentId} can no longer be edited (status: ${status}).`);
    this.name = "IntentNotEditableError";
  }
}
