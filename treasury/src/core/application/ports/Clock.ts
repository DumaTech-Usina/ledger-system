/** Time source, injected so use cases stay deterministic and testable. */
export interface Clock {
  now(): string; // ISO-8601
}
