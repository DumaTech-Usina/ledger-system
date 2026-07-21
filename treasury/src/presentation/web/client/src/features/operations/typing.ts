const MIN_TYPING_MS = 350;
const MAX_TYPING_MS = 3000;
const MS_PER_CHAR = 22;

/** Grows with message length but never past 3s — so a long reply types faster per character, not longer overall. */
export function typingDurationMs(text: string): number {
  return Math.min(MAX_TYPING_MS, MIN_TYPING_MS + text.length * MS_PER_CHAR);
}
