import { SlotType } from "../../domain/enums/SlotType";
import type { Resolution } from "../../domain/services/PartyResolution";
import type { SlotDefinition, SlotValue } from "../../domain/value-objects/Slot";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";

/** What a turn did with one PARTY slot. Reported alongside the dialog state, never inside it. */
export interface IdentityOutcome {
  slot: string;
  resolution: Resolution;
}

/**
 * Resolves a PARTY slot's answer to a canonical PartyId, or reports why it could not.
 *
 * This is the step that removes the ghost party. Before it, whatever the user typed became the
 * partyId and, from there, an entity inside an immutable event; four spellings of one supplier were
 * four counterparties in the book, and nothing anywhere said so.
 *
 * It lives in the application layer, not in DialogEngine, because it needs a lookup. DialogEngine
 * answers "is this answer legal in shape" and stays pure and synchronous; "does this entity exist"
 * is a different question with different machinery.
 *
 * Returns null for any slot that is not a PARTY slot — nothing to resolve.
 */
export async function resolveIdentitySlot(
  slot: SlotDefinition,
  value: SlotValue,
  directory: PartyDirectoryPort,
): Promise<Resolution | null> {
  if (slot.type !== SlotType.PARTY) return null;
  return directory.resolve({ mention: value });
}

/**
 * Whether a resolution may be written into the intent's answers.
 *
 * Only an exact rung qualifies. A similarity hit is deliberately excluded: it is close, not equal,
 * and confirming it is the user's to do — picking the likely one silently is how two real
 * counterparties get merged into one aggregate, irreversibly, because events are immutable.
 */
export function isRecordable(resolution: Resolution): boolean {
  return resolution.kind === "resolved" && !resolution.needsConfirmation;
}

/** The canonical id to record. Never the mention: what the user typed is not an identity. */
export function recordableId(resolution: Resolution): string | null {
  return isRecordable(resolution) && resolution.kind === "resolved" ? resolution.partyId : null;
}

/** A compact, greppable audit line describing how a mention was (or was not) resolved. */
export function auditDetail(slot: string, resolution: Resolution): string {
  switch (resolution.kind) {
    case "resolved":
      return `${slot}: "${resolution.mention.text}" → ${resolution.partyId} via ${resolution.rule}${
        resolution.needsConfirmation ? " (needs confirmation)" : ""
      }`;
    case "ambiguous":
      return `${slot}: "${resolution.mention.text}" → ambiguous [${resolution.candidates
        .map((c) => c.partyId)
        .join(", ")}]`;
    case "new":
      return `${slot}: "${resolution.mention.text}" → no known party`;
  }
}
