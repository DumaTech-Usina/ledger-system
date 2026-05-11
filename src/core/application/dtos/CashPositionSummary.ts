import { Money } from "../../domain/value-objects/Money";

/**
 * Saldo Atual = totalCashIn − totalCashOut (may be conceptually negative).
 * Money cannot be negative, so both sides are exposed separately.
 * The presentation layer computes the net and handles the sign.
 */
export interface CashPositionSummary {
  totalCashIn: Money;
  totalCashOut: Money;
  openReceivables: Money;
  contingentExposure: Money;
  currency: string;
  asOf: Date;
}
