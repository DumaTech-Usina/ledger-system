import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import type { PartyDirectoryPort } from "../../../../core/application/ports/PartyDirectoryPort";
import { PartyIdentityState } from "../../../../core/domain/enums/PartyIdentityState";
import { Permission } from "../../../../core/domain/enums/Permission";
import { PartyAttributeKey } from "../../../../core/domain/value-objects/PartyAttribute";
import {
  PartyRegistrationError,
  type RegisterPartyUseCase,
} from "../../../../core/application/use-cases/RegisterParty";
import { IdentityLinkError, type LinkIdentityUseCase } from "../../../../core/application/use-cases/LinkIdentity";
import type { ListPendingIdentitiesUseCase } from "../../../../core/application/use-cases/ListPendingIdentities";
import type { GetPartyEventsUseCase } from "../../../../core/application/use-cases/GetPartyEvents";
import type { GetPartyPageUseCase, HistoryQuery, Side, SideQuery } from "../../../../core/application/use-cases/GetPartyPage";
import { currentUser, requireAuth, requirePermission } from "../middleware/auth";

/** Hands a refusal the person can act on back as 422; anything else stays a fault. */
const refusals =
  (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof PartyRegistrationError || err instanceof IdentityLinkError) {
        res.status(422).json({ error: err.message });
        return;
      }
      next(err);
    }
  };

/**
 * The party registry. The notification is for everyone who is signed in (REQ-321); registering,
 * linking and reading the registry, documents included, need curation (REQ-402).
 */
export function partyRoutes(
  directory: PartyDirectoryPort,
  registerParty: RegisterPartyUseCase,
  linkIdentity: LinkIdentityUseCase,
  listPending: ListPendingIdentitiesUseCase,
  getPartyEvents: GetPartyEventsUseCase,
  getPartyPage: GetPartyPageUseCase,
): Router {
  const router = Router();
  const curating = [requireAuth, requirePermission(Permission.PARTY_CURATE)];
  const consulting = [requireAuth, requirePermission(Permission.DASHBOARD_READ)];

  router.get("/pending", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ pending: await listPending.execute() });
    } catch (err) {
      next(err);
    }
  });

  // Who can be looked at, for everyone who consults (REQ-401). Names only: documents stay with curation.
  // A linked identity is left out, because it now reads as the party it was linked to.
  router.get("/names", ...consulting, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const parties = (await directory.list())
        .filter((p) => p.identityState !== PartyIdentityState.MERGED)
        .map((p) => ({ partyId: p.partyId, displayName: p.displayName, state: p.identityState }));
      res.json({ parties });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:partyId/events", ...consulting, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getPartyEvents.execute(req.params.partyId);
      if (!result) {
        res.status(404).json({ error: "Party not found." });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // §8.4: the party page. The viewer sees it whole, without actions (REQ-638): actions are the
  // conversation routes, which already refuse a viewer.
  router.get("/:partyId/page", ...consulting, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getPartyPage.execute(req.params.partyId);
      if (!result) {
        res.status(404).json({ error: "Party not found." });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // The history, paged and filtered on its own, by date of record (refinement of 2026-11-12).
  router.get("/:partyId/history", ...consulting, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getPartyPage.history(req.params.partyId, historyQuery(req.query));
      if (!result) {
        res.status(404).json({ error: "Party not found." });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // One side of the page, paged and filtered on its own (refinement of 2026-11-12).
  router.get("/:partyId/positions/:side", ...consulting, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const side = req.params.side;
      if (!SIDES.has(side)) {
        res.status(404).json({ error: "Unknown side." });
        return;
      }
      const result = await getPartyPage.side(req.params.partyId, side as Side, sideQuery(req.query));
      if (!result) {
        res.status(404).json({ error: "Party not found." });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", ...curating, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const parties = (await directory.list())
        .filter((p) => p.identityState === PartyIdentityState.IDENTIFIED)
        .map((p) => ({
          partyId: p.partyId,
          displayName: p.displayName,
          kind: p.attributes[PartyAttributeKey.TYPE]?.value ?? null,
          document: p.attributes[PartyAttributeKey.DOCUMENT]?.value ?? null,
          // Absent on a party loaded from elsewhere: not known, which is not the same as "no".
          hasBankAccount: bankAccountOf(p.attributes[PartyAttributeKey.BANK_ACCOUNT]?.value),
        }));
      res.json({ parties });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/",
    ...curating,
    refusals(async (req, res) => {
      const { displayName, kind, hasBankAccount, document } = req.body ?? {};
      const party = await registerParty.execute({
        displayName,
        kind,
        hasBankAccount: hasBankAccount === true,
        document,
        userId: currentUser(req).id,
      });
      res.status(201).json({ partyId: party.partyId, displayName: party.displayName });
    }),
  );

  router.post(
    "/links",
    ...curating,
    refusals(async (req, res) => {
      const { identifier, partyId } = req.body ?? {};
      const link = await linkIdentity.execute({ identifier, partyId, userId: currentUser(req).id });
      res.status(201).json({ link });
    }),
  );

  return router;
}

const SIDES = new Set(["usinaOwes", "partyOwes", "unclassified"]);
const SORT_KEYS = new Set(["createdAt", "dueAt"]);
const SORT_ORDERS = new Set(["ASC", "DESC"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** Reads only what the Ledger can apply; anything else is dropped, as the Ledger's own route does. */
function sideQuery(q: Request["query"]): SideQuery {
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const num = (v: unknown) => {
    const n = Number(one(v));
    return Number.isFinite(n) ? n : undefined;
  };
  const types = ([] as unknown[]).concat(q.objectType ?? []).flatMap((v) => (typeof v === "string" ? v.split(",") : [])).map((v) => v.trim()).filter(Boolean);
  const sortBy = one(q.sortBy);
  const sortOrder = one(q.sortOrder);
  const from = one(q.from);
  const to = one(q.to);
  return {
    page: num(q.page),
    limit: num(q.limit),
    ...(sortBy && SORT_KEYS.has(sortBy) ? { sortBy } : {}),
    ...(sortOrder && SORT_ORDERS.has(sortOrder) ? { sortOrder } : {}),
    ...(types.length ? { objectType: types } : {}),
    ...(from && ISO_DATE.test(from) ? { from } : {}),
    ...(to && ISO_DATE.test(to) ? { to } : {}),
  };
}

const STATUSES = new Set(["all", "standing", "retracted"]);

function historyQuery(q: Request["query"]): HistoryQuery {
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const list = (v: unknown) =>
    ([] as unknown[]).concat(v ?? []).flatMap((x) => (typeof x === "string" ? x.split(",") : [])).map((x) => x.trim()).filter(Boolean);
  const base = sideQuery(q);
  const status = one(q.status);
  const eventType = list(q.eventType);
  const reporter = list(q.reporter);
  return {
    page: base.page,
    limit: base.limit,
    ...(base.sortOrder ? { sortOrder: base.sortOrder } : {}),
    ...(base.from ? { from: base.from } : {}),
    ...(base.to ? { to: base.to } : {}),
    ...(eventType.length ? { eventType } : {}),
    ...(reporter.length ? { reporter } : {}),
    ...(status && STATUSES.has(status) ? { status: status as HistoryQuery["status"] } : {}),
  };
}

function bankAccountOf(value: string | undefined): boolean | null {
  return value === undefined ? null : value === "yes";
}
