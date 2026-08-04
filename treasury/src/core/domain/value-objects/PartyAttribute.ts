import { AttributeSource } from "../enums/AttributeSource";
import { AttributeState } from "../enums/AttributeState";

/**
 * One attribute of a Party, carrying its own provenance. A KNOWN attribute has a value; a DECLINED
 * one does not (the user was asked and did not answer). An attribute that was never asked is simply
 * absent from the map — that is UNKNOWN.
 */
export interface PartyAttribute {
  state: AttributeState;
  /** Present only when state is KNOWN. */
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
 * Well-known attribute keys. Two of them (DOCUMENT, TYPE) participate in resolution or
 * classification, so they are named rather than left to convention.
 */
export const PartyAttributeKey = {
  /** CPF/CNPJ. An attribute with a uniqueness constraint — never the identity. */
  DOCUMENT: "document",
  /** The Ledger's published party vocabulary (company | client | supplier | bank | gateway). */
  TYPE: "type",
} as const;

/** Reading an absent attribute yields UNKNOWN, which is a legitimate answer — never a default. */
export function attributeState(
  attributes: Record<string, PartyAttribute>,
  key: string,
): AttributeState | "unknown" {
  return attributes[key]?.state ?? "unknown";
}
