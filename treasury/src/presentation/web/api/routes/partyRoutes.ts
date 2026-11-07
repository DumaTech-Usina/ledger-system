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

function bankAccountOf(value: string | undefined): boolean | null {
  return value === undefined ? null : value === "yes";
}
