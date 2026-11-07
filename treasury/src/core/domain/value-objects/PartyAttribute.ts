import { AttributeSource } from "../enums/AttributeSource";
import { AttributeState } from "../enums/AttributeState";

/**
 * One attribute of a Party, carrying its own provenance. An attribute nobody has observed is simply
 * absent from the map — that is UNKNOWN.
 */
export interface PartyAttribute {
  state: AttributeState;
  value?: string;
  source: AttributeSource;
  /** In [0, 1]. DERIVED values carry reduced confidence and are never shown as the user's word. */
  confidence: number;
  capturedAt: string;
  /** User id, or the importing system's identifier. */
  capturedBy?: string;
  /** The intent during which the value was captured, when it came from a conversation. */
  intentId?: string;
}

/**
 * Well-known attribute keys, named rather than left to convention.
 */
export const PartyAttributeKey = {
  /** CPF/CNPJ. An attribute with a uniqueness constraint — never the identity. */
  DOCUMENT: "document",
  /** person | company on what is registered; a load may carry its source's own vocabulary. */
  TYPE: "type",
  /** "yes" | "no": whether the party receives or pays through a bank account (REQ-314). */
  BANK_ACCOUNT: "bank_account",
} as const;

/** Reading an absent attribute yields UNKNOWN, which is a legitimate answer — never a default. */
export function attributeState(
  attributes: Record<string, PartyAttribute>,
  key: string,
): AttributeState | "unknown" {
  return attributes[key]?.state ?? "unknown";
}
