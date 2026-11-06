export type StoreMode = "memory" | "sqlite";

/**
 * Where intents, the audit and the conversation log live.
 *
 * Against a real Ledger the answer is SQLite and memory is refused: facts would be recorded for real
 * while the audit that must outlive them (REQ-801) and the link back to them (REQ-501) vanished at
 * the next restart. Unset, it follows the same reasoning, so a deployment cannot lose them by
 * forgetting a variable. Without a real Ledger nothing permanent exists, and memory is the default.
 */
export function resolveOperationsStore(ledgerMode: string, configured?: StoreMode): StoreMode {
  if (ledgerMode !== "live") return configured ?? "memory";
  if (configured === "memory") {
    throw new Error(
      "OPERATIONS_STORE_MODE=memory cannot be used with LEDGER_MODE=live: the audit would be lost at " +
        "the next restart while the facts stay recorded. Use sqlite.",
    );
  }
  return "sqlite";
}
