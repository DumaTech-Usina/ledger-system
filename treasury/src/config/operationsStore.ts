export type StoreMode = "memory" | "sqlite";

/**
 * Where what must outlive a restart lives: intents, the audit and the conversation log, and the party
 * registry with its identity mapping.
 *
 * Against a real Ledger the answer is SQLite and memory is refused: facts would be recorded for real
 * while the audit (REQ-801), the link back to them (REQ-501) and the identities they name vanished at
 * the next restart. Unset, it follows the same reasoning, so a deployment cannot lose them by
 * forgetting a variable. Without a real Ledger nothing permanent exists, and memory is the default.
 */
export function resolveStore(ledgerMode: string, variable: string, configured?: StoreMode): StoreMode {
  if (ledgerMode !== "live") return configured ?? "memory";
  if (configured === "memory") {
    throw new Error(
      `${variable}=memory cannot be used with LEDGER_MODE=live: the data would be lost at the next ` +
        "restart while the facts stay recorded. Use sqlite.",
    );
  }
  return "sqlite";
}
