import { ObjectType } from "../../domain/enums/ObjectType";
import { Money } from "../../domain/value-objects/Money";

/**
 * One line of what a total is made of: the open balance held by a single kind of economic object.
 *
 * Object types carrying no open balance are absent rather than published as zero — an absent line
 * means nothing is outstanding of that kind, which is what the aggregate itself says.
 */
export interface OpenBalanceByObjectType {
  objectType: ObjectType;
  openBalance: Money;
}

/**
 * Saldo Atual = totalCashIn − totalCashOut (may be conceptually negative).
 * Money cannot be negative, so both sides are exposed separately.
 * The presentation layer computes the net and handles the sign.
 */
export interface CashPositionSummary {
  totalCashIn: Money;
  totalCashOut: Money;
  openReceivables: Money;
  /** Recognized obligations not yet paid. Never netted against openReceivables. */
  openPayables: Money;
  contingentExposure: Money;
  /**
   * What each of the three totals above is made of, by kind of object.
   *
   * Not a new figure: the per-type aggregation is what the totals are folded FROM
   * (`aggregateOpenBalancesByObjectType`), and until now it was collapsed into three numbers and
   * discarded. Each list sums exactly to its total, by construction — the same rows, grouped one
   * step earlier.
   *
   * Deliberately NOT crossed with the due-date split: `openPayablesByType` says what is owed and of
   * what kind, `overduePayable`/`upcomingPayable`/`undatedPayable` say when. Crossing the two axes
   * would publish a matrix nobody asked to read.
   */
  openReceivablesByType: OpenBalanceByObjectType[];
  openPayablesByType: OpenBalanceByObjectType[];
  contingentExposureByType: OpenBalanceByObjectType[];
  currency: string;
  asOf: Date;
}
