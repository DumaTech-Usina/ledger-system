import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { EventType } from "../../domain/enums/EventType";
import { Relation } from "../../domain/enums/Relation";
import { Money } from "../../domain/value-objects/Money";
import { InstitutionCashEvent } from "../dtos/InstitutionBalance";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { addDays, agendaDayOf } from "./PayablesAgendaService";

/**
 * The balance of each institution at the end of a day (treasury/docs/requisitos_refinados.md §8.8,
 * REQ-670–673). A READING of the chain, like the agendas: it records nothing.
 *
 * An institution's balance starts at its opening balance — what its statement showed at the end of the
 * opening day — and moves only by what happened AFTER that day: whatever came before is already in the
 * statement, and counting it again would move the same money twice (REQ-671). Without an opening the
 * balance is unknown, never zero; its movements are still shown.
 *
 * Money that moved citing no institution is never spread among them: it is published apart, from the
 * first opening day on, and never added to the known total (REQ-650, REQ-673).
 *
 * Amounts are signed (an account can be overdrawn) and kept per currency: the Ledger never adds two
 * currencies together.
 */

export type Units = Map<string, bigint>;

export interface InstitutionBalance {
  /** The institution's object id, `instituicao:<key>`. */
  institution: string;
  /** The standing opening read at this day, or null when none is on record by then. */
  opening: { amountUnits: bigint; currency: string; day: string; eventId: string } | null;
  /** What moved after the opening day (or, with no opening, everything up to the day). */
  cashIn: Units;
  cashOut: Units;
  transfersIn: Units;
  transfersOut: Units;
  /** Opening + in − out + transfers in − transfers out. Null without an opening: unknown. */
  balance: Units | null;
}

export interface InstitutionBalances {
  asOf: string;
  institutions: InstitutionBalance[];
  /** The sum of the balances that are known, and whose they are. */
  known: { total: Units; institutions: string[] };
  /** Cash in and out citing no institution, after `since` (the first opening day; null = none yet). */
  unknown: { since: string | null; cashIn: Units; cashOut: Units; count: number };
}

export class InstitutionBalanceService {
  constructor(
    private readonly repo: LedgerEventRepository,
    /** The Usina's zone (REQ-225): a day is a day in São Paulo. */
    private readonly timeZone: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async read(query: { asOf?: string } = {}): Promise<InstitutionBalances> {
    const asOf = query.asOf ?? agendaDayOf(this.now(), this.timeZone);
    // Any instant of the day `asOf` in any zone falls before the start of the day after next in UTC;
    // the exact cut is made below, by the day in the Usina's zone.
    const events = (await this.repo.findInstitutionCashEvents(new Date(`${addDays(asOf, 2)}T00:00:00Z`)))
      .map((e) => ({ ...e, day: agendaDayOf(e.occurredAt, this.timeZone) }))
      .filter((e) => e.day <= asOf);

    const openings = new Map<string, InstitutionBalance["opening"] & { recordedAt: number }>();
    for (const e of events) {
      if (e.eventType !== EventType.OPENING_BALANCE || e.institutions.length !== 1) continue;
      const key = e.institutions[0].objectId;
      const current = openings.get(key);
      const candidate = {
        amountUnits: e.economicEffect === EconomicEffect.CASH_OUT ? -e.amountUnits : e.amountUnits,
        currency: e.currency,
        day: e.day,
        eventId: e.eventId,
        recordedAt: e.recordedAt.getTime(),
      };
      // The latest standing opening counts; the Treasury keeps it to one (REQ-670).
      if (!current || candidate.day > current.day || (candidate.day === current.day && candidate.recordedAt > current.recordedAt)) {
        openings.set(key, candidate);
      }
    }

    const balances = new Map<string, InstitutionBalance>();
    const of = (institution: string): InstitutionBalance => {
      let b = balances.get(institution);
      if (!b) {
        const opening = openings.get(institution);
        b = {
          institution,
          opening: opening ? { amountUnits: opening.amountUnits, currency: opening.currency, day: opening.day, eventId: opening.eventId } : null,
          cashIn: new Map(),
          cashOut: new Map(),
          transfersIn: new Map(),
          transfersOut: new Map(),
          balance: null,
        };
        balances.set(institution, b);
      }
      return b;
    };
    const after = (institution: string, day: string) => {
      const opening = openings.get(institution);
      return !opening || day > opening.day;
    };

    const since = [...openings.values()].map((o) => o.day).sort()[0] ?? null;
    const unknown = { since, cashIn: new Map() as Units, cashOut: new Map() as Units, count: 0 };

    for (const e of events) {
      if (e.eventType === EventType.OPENING_BALANCE) {
        if (e.institutions.length === 1) of(e.institutions[0].objectId);
        continue;
      }
      if (e.eventType === EventType.INSTITUTION_TRANSFER) {
        for (const leg of e.institutions) {
          const b = of(leg.objectId);
          if (!after(leg.objectId, e.day)) continue;
          if (leg.relation === Relation.TRANSFERS_FROM) add(b.transfersOut, e);
          if (leg.relation === Relation.TRANSFERS_TO) add(b.transfersIn, e);
        }
        continue;
      }
      if (e.economicEffect !== EconomicEffect.CASH_IN && e.economicEffect !== EconomicEffect.CASH_OUT) continue;
      const cited = e.institutions.find((i) => i.relation === Relation.REFERENCES);
      if (!cited) {
        if (since !== null && e.day <= since) continue;
        add(e.economicEffect === EconomicEffect.CASH_IN ? unknown.cashIn : unknown.cashOut, e);
        unknown.count++;
        continue;
      }
      const b = of(cited.objectId);
      if (!after(cited.objectId, e.day)) continue;
      add(e.economicEffect === EconomicEffect.CASH_IN ? b.cashIn : b.cashOut, e);
    }

    const known = { total: new Map() as Units, institutions: [] as string[] };
    const institutions = [...balances.values()].sort((a, b) => a.institution.localeCompare(b.institution));
    for (const b of institutions) {
      if (!b.opening) continue;
      const balance: Units = new Map([[b.opening.currency, b.opening.amountUnits]]);
      for (const [units, sign] of [[b.cashIn, 1n], [b.cashOut, -1n], [b.transfersIn, 1n], [b.transfersOut, -1n]] as const) {
        for (const [currency, u] of units) balance.set(currency, (balance.get(currency) ?? 0n) + sign * u);
      }
      b.balance = balance;
      known.institutions.push(b.institution);
      for (const [currency, u] of balance) known.total.set(currency, (known.total.get(currency) ?? 0n) + u);
    }

    return { asOf, institutions, known, unknown };
  }
}

function add(units: Units, e: InstitutionCashEvent): void {
  units.set(e.currency, (units.get(e.currency) ?? 0n) + e.amountUnits);
}

/** A signed amount as the API publishes it: "-1200.00". Money itself is never negative. */
export function signedAmount(units: bigint, currency: string): string {
  const abs = Money.fromUnits(units < 0n ? -units : units, currency).toString();
  return units < 0n ? `-${abs}` : abs;
}
