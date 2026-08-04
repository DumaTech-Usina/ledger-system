/**
 * Deterministic, reproducible normalization — the shared vocabulary of the resolution cascade.
 * Pure and model-free on purpose: two mentions that differ only in case, accent, spacing, corporate
 * suffix or document punctuation must always reduce to the same key, and must do so identically
 * everywhere it runs.
 */

/** Corporate suffixes stripped from a name before comparison. Order matters: longest first. */
const CORPORATE_SUFFIXES = [
  "sociedade anonima",
  "eireli",
  "ltda",
  "epp",
  "mei",
  "me",
  "sa",
  "s a",
];

function stripAccents(text: string): string {
  // Explicit escapes rather than literal combining marks — the class stays readable in any editor.
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * A name reduced to its comparison key: accent-free, lowercase, punctuation-free, single-spaced,
 * and without trailing corporate suffixes. "Alfa Ltda." and "ALFA" both become "alfa".
 */
export function normalizeName(text: string): string {
  let out = stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  // Suffixes only count at the end of the name, and more than one may be stacked ("Alfa S.A. ME").
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const suffix of CORPORATE_SUFFIXES) {
      if (out === suffix) continue; // a name that is *only* a suffix keeps it — stripping empties it
      if (out.endsWith(` ${suffix}`)) {
        out = out.slice(0, -(suffix.length + 1)).trim();
        stripped = true;
        break;
      }
    }
  }

  return out;
}

/** A document reduced to digits only. "12.345.678/0001-99" and "12345678000199" agree. */
export function normalizeDocument(text: string): string {
  return text.replace(/\D+/g, "");
}

/** Levenshtein edit distance. Iterative, single-row — no dependency, fully deterministic. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }

  return previous[b.length];
}

/**
 * Similarity of two already-normalized names, in [0, 1]. 1 is an exact match; 0 shares nothing.
 * Length-relative so that one typo in a short name weighs more than one typo in a long one.
 */
export function similarity(a: string, b: string): number {
  if (a === "" && b === "") return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  return 1 - editDistance(a, b) / longest;
}
