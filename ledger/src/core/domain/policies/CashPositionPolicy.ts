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
 * Object types where Usina is the debtor — obligations it owes, recognized before they are paid.
 *
 * These exist as originated positions only since OBLIGATION_RECOGNIZED; before it, every one of
 * them was a cash-basis fact that originated nothing. They are kept out of `openExposure`, which
 * measures what is owed TO Usina: a total mixing the two directions would mean nothing.
 *
 * COMMISSION_PAYABLE is deliberately absent. It is originated by COMMISSION_SPLIT and has counted
 * toward openExposure since long before this work; moving it now would silently restate a
 * published figure. Reclassifying it is a separate decision, on its own evidence.
 */
export const USINA_PAYABLE_OBJECT_TYPES = new Set<ObjectType>([
  ObjectType.PAYABLE,
  ObjectType.PAYROLL,
  ObjectType.SERVICE_FEE,
  ObjectType.INFRASTRUCTURE_COST,
  ObjectType.TAX,
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
