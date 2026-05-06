import { ObjectType } from "../enums/ObjectType";

/**
 * Object types where Usina is the creditor — money genuinely owed back to Usina.
 * COMMISSION_RECEIVABLE is excluded: most of it is pass-through to brokers and
 * settles automatically; including it would overstate Usina's net expected cash.
 */
export const USINA_RECEIVABLE_OBJECT_TYPES = new Set<ObjectType>([
  ObjectType.LOAN,
  ObjectType.ADVANCE,
  ObjectType.RECEIVABLE,
]);

/**
 * Object types that represent potential future cash outflows with uncertain timing or amount.
 */
export const USINA_CONTINGENT_OBJECT_TYPES = new Set<ObjectType>([
  ObjectType.CONTINGENT_CLAIM,
  ObjectType.DISPUTE,
  ObjectType.PENALTY,
  ObjectType.CHARGEBACK,
]);
