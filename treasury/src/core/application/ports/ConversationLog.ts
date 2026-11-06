import type { AuditActor } from "./AuditLog";

export interface ConversationEntry {
  id: string;
  actor: AuditActor;
  intentId: string;
  at: string;
  type: string;
  detail?: string;
}

/**
 * The steps of a conversation before anything is sent: answers, refused answers, how a mention
 * resolved, what was typed. Kept apart from the AuditLog on purpose, because REQ-804 audits only what
 * goes to the Ledger (CA-804: someone who gives up before sending leaves nothing audited).
 *
 * It serves the intent's history screen and preserves what the user actually said. It carries no
 * promise of permanence: how long it is kept, and what else it may observe, is still DEC-012.
 */
export interface ConversationLog {
  record(entry: Omit<ConversationEntry, "id">): Promise<void>;
  listByIntent(intentId: string): Promise<ConversationEntry[]>;
}
