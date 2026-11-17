import { Router, Request, Response, NextFunction } from "express";
import { CashPositionService } from "../../../../core/application/services/CashPositionService";
import {
  InstitutionBalanceService,
  InstitutionBalances,
  Units,
  signedAmount,
} from "../../../../core/application/services/InstitutionBalanceService";
import { isAgendaDay } from "../../../../core/application/services/PayablesAgendaService";
import { serializeCashPosition } from "../serializers/cashPositionSerializer";

const amounts = (units: Units) => Object.fromEntries([...units].map(([currency, u]) => [currency, signedAmount(u, currency)]));

function serializeInstitutions(b: InstitutionBalances) {
  return {
    asOf: b.asOf,
    institutions: b.institutions.map((i) => ({
      institution: i.institution,
      opening: i.opening
        ? { amount: signedAmount(i.opening.amountUnits, i.opening.currency), currency: i.opening.currency, day: i.opening.day, eventId: i.opening.eventId }
        : null,
      cashIn: amounts(i.cashIn),
      cashOut: amounts(i.cashOut),
      transfersIn: amounts(i.transfersIn),
      transfersOut: amounts(i.transfersOut),
      // Null — never zero — when no opening is on record: the balance is unknown (REQ-673).
      balance: i.balance ? amounts(i.balance) : null,
    })),
    known: { total: amounts(b.known.total), institutions: b.known.institutions },
    unknown: { since: b.unknown.since, cashIn: amounts(b.unknown.cashIn), cashOut: amounts(b.unknown.cashOut), count: b.unknown.count },
  };
}

export function cashPositionRoutes(svc: CashPositionService, institutions?: InstitutionBalanceService): Router {
  const router = Router();
  /**
   * GET /api/cash-position/institutions?asOf=YYYY-MM-DD — the balance of each institution at the end of
   * that day in the Usina's zone (default: today), the known total, and what moved citing no
   * institution (treasury/docs/requisitos_refinados.md §8.8). A reading; it records nothing.
   */
  if (institutions) {
    router.get("/institutions", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const asOf = req.query.asOf;
        if (asOf !== undefined && (typeof asOf !== "string" || !isAgendaDay(asOf))) {
          throw Object.assign(new Error("'asOf' must be a date as YYYY-MM-DD"), { statusCode: 400 });
        }
        res.json(serializeInstitutions(await institutions.read({ asOf: asOf as string | undefined })));
      } catch (err) {
        next(err);
      }
    });
  }
  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(serializeCashPosition(await svc.summarize()));
    } catch (err) {
      next(err);
    }
  });
  return router;
}
