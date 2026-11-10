import { createHash } from "node:crypto";

/**
 * SHA-256 of a signal's kind and fields, keys in a fixed order: the same reading always hashes the
 * same, and any change in a field changes it (REQ-260). Shared by the signal record and the message
 * the producer publishes, so both sides speak of the same reading the same way.
 */
export function signalFingerprint(kind: string, fields: Record<string, string>): string {
  const ordered = Object.keys(fields)
    .sort()
    .map((key) => [key, fields[key]]);
  return createHash("sha256").update(JSON.stringify({ kind, fields: ordered })).digest("hex");
}
