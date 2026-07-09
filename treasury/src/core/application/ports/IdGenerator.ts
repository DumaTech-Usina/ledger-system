/** Identifier source, injected so use cases stay deterministic and testable. */
export interface IdGenerator {
  next(): string;
}
