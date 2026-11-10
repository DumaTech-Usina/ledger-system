/** The flag that loads the example events into the dev Ledger. */
export const FILLED_EXAMPLE_FLAG = "--filled-example";

/**
 * Which seeds the dev Ledger starts with: the example only when asked for, otherwise none. The dev
 * Ledger is in memory either way, so an empty start means an empty book, not missing data.
 */
export function seedsFor<T>(argv: readonly string[], example: readonly T[]): T[] {
  return argv.includes(FILLED_EXAMPLE_FLAG) ? [...example] : [];
}
