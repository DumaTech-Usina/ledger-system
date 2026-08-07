import { Router, type Request, type Response, type NextFunction } from "express";
import { listScenarios } from "../../../../core/domain/scenarios/Scenario";
import type { StartIntentUseCase } from "../../../../core/application/use-cases/StartIntent";
import type { AdvanceDialogUseCase } from "../../../../core/application/use-cases/AdvanceDialog";
import type { ApplyAnswersUseCase } from "../../../../core/application/use-cases/ApplyAnswers";
import type { InterpretUtteranceUseCase } from "../../../../core/application/use-cases/InterpretUtterance";
import type { PreviewIntentUseCase } from "../../../../core/application/use-cases/PreviewIntent";
import type { SubmitIntentUseCase } from "../../../../core/application/use-cases/SubmitIntent";
import type { SubmitRectificationUseCase } from "../../../../core/application/use-cases/SubmitRectification";
import type { DecideIdentityUseCase } from "../../../../core/application/use-cases/DecideIdentity";
import type { RecordPartyAttributeUseCase } from "../../../../core/application/use-cases/RecordPartyAttribute";
import type { ListIncompletePartiesUseCase } from "../../../../core/application/use-cases/ListIncompleteParties";
import type { ListSettlementCandidatesUseCase } from "../../../../core/application/use-cases/ListSettlementCandidates";
import type { ListPositionActionsUseCase } from "../../../../core/application/use-cases/ListPositionActions";
import type { StartPositionActionUseCase } from "../../../../core/application/use-cases/StartPositionAction";
import { IdentityDecisionKind } from "../../../../core/domain/value-objects/IdentityDecision";
import { Permission } from "../../../../core/domain/enums/Permission";
import { currentUser, requirePermission } from "../middleware/auth";

/**
 * Drives the guided conversation: list scenarios, start an intent, answer one slot at a time,
 * preview (confirm-before-commit), and submit. The intent is attributed to the authenticated user.
 */
export function conversationRoutes(
  startIntent: StartIntentUseCase,
  advanceDialog: AdvanceDialogUseCase,
  applyAnswers: ApplyAnswersUseCase,
  interpretUtterance: InterpretUtteranceUseCase,
  previewIntent: PreviewIntentUseCase,
  submitIntent: SubmitIntentUseCase,
  submitRectification: SubmitRectificationUseCase,
  decideIdentity: DecideIdentityUseCase,
  recordPartyAttribute: RecordPartyAttributeUseCase,
  listIncompleteParties: ListIncompletePartiesUseCase,
  listSettlementCandidates: ListSettlementCandidatesUseCase,
  listPositionActions: ListPositionActionsUseCase,
  startPositionAction: StartPositionActionUseCase,
  /**
   * Forgets the positions a successful write touched.
   *
   * Wired HERE and not inside the use cases on purpose: a use case has no business knowing a cache
   * exists, and the import barrier (`snapshot-isolation.test.ts`) keeps the write path free of it
   * mechanically. Invalidating is composition, not domain — this is the seam where the two meet.
   */
  forgetPositions: (objectIds: readonly string[]) => void = () => {},
): Router {
  const router = Router();

  /** The positions a submitted candidate moved, as the candidate itself declares them. */
  const movedBy = (result: { candidate?: { objects?: { objectId: string }[] } } | undefined) =>
    (result?.candidate?.objects ?? []).map((o) => o.objectId);

  /**
   * What can be recorded about a position. Derived from the Ledger's algebra crossed with what
   * treasury can produce — never a list anyone maintains. An empty list is a legitimate answer.
   */
  router.get(
    "/positions/:objectId/actions",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await listPositionActions.execute(req.params.objectId);
        if (!result) {
          res.status(404).json({ error: "Position not found." });
          return;
        }
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * Opens a conversation already knowing which position it is about. The position answers what it
   * can; the operator answers the rest, through the same dialog as any other operation.
   */
  router.post(
    "/positions/:objectId/start",
    requirePermission(Permission.INTENT_SUBMIT),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { scenarioId, variantChoice } = req.body ?? {};
        if (typeof scenarioId !== "string" || scenarioId.trim() === "") {
          res.status(400).json({ error: "scenarioId is required." });
          return;
        }
        res.json(
          await startPositionAction.execute({
            objectId: req.params.objectId,
            scenarioId,
            variantChoice: typeof variantChoice === "string" ? variantChoice : undefined,
            userId: currentUser(req).id,
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/scenarios", (_req: Request, res: Response) => {
    res.json({
      scenarios: listScenarios().map((s) => ({ id: s.id, title: s.title, description: s.description })),
    });
  });

  router.post("/start", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scenarioId } = req.body ?? {};
      const result = await startIntent.execute({ scenarioId, userId: currentUser(req).id });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:intentId/answer", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key, value } = req.body ?? {};
      const result = await advanceDialog.execute({ intentId: req.params.intentId, key, value });
      res.status(result.error ? 422 : 200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:intentId/apply", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answers, mode } = req.body ?? {};
      const result = await applyAnswers.execute({ intentId: req.params.intentId, answers: answers ?? [], mode });
      res.status(result.rejected.length ? 422 : 200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // First utterance, no scenario chosen yet: classify → create the intent → merge (or clarify).
  router.post("/interpret", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { utterance } = req.body ?? {};
      const result = await interpretUtterance.execute({ utterance: utterance ?? "", userId: currentUser(req).id });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Continue an existing intent from free text (scenario already bound).
  router.post("/:intentId/interpret", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { utterance } = req.body ?? {};
      const result = await interpretUtterance.execute({
        intentId: req.params.intentId,
        utterance: utterance ?? "",
        userId: currentUser(req).id,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Deliberately its own endpoint, not another way to answer the slot: creating an identity — or
  // declaring one cannot be identified — is an act distinct from replying to a question, and it is
  // the only conversational path that mints a PartyId.
  router.post("/:intentId/identity", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slot, kind, mention, justification } = req.body ?? {};
      if (kind !== IdentityDecisionKind.CREATE && kind !== IdentityDecisionKind.UNIDENTIFIABLE) {
        res.status(422).json({ error: "kind must be 'create' or 'unidentifiable'." });
        return;
      }
      const result = await decideIdentity.execute({
        intentId: req.params.intentId,
        slot,
        kind,
        mention,
        justification,
        userId: currentUser(req).id,
      });
      res.json(result);
    } catch (err) {
      // A refused decision (not admissible, missing justification) is the user's to fix, not a fault.
      res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Answering (or refusing) the one optional question the confirmation card may offer. Separate
  // from the intent entirely: it can only ever run after the fact is already complete, and nothing
  // here can hold a submission back.
  router.post("/:intentId/enrich", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { partyId, key, value } = req.body ?? {};
      const party = await recordPartyAttribute.execute({
        partyId,
        key,
        value,
        userId: currentUser(req).id,
        intentId: req.params.intentId,
      });
      res.json({ partyId: party.partyId });
    } catch (err) {
      res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // The backlog: what is still unknown, computed on demand and never stored.
  router.get("/parties/incomplete", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await listIncompleteParties.execute());
    } catch (err) {
      next(err);
    }
  });

  // The positions this settlement could be about. An empty list is the ordinary answer and means
  // the conversation asks its question the way it always has — never that something is missing.
  router.get("/:intentId/candidates", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await listSettlementCandidates.execute(req.params.intentId));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:intentId/preview", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await previewIntent.execute(req.params.intentId));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/:intentId/submit",
    requirePermission(Permission.INTENT_SUBMIT),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await submitIntent.execute(req.params.intentId);
        if (result.status === "accepted") forgetPositions(movedBy(result));
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // Rectify a recorded entry. It is not a guided conversation: the operator points at the entry that
  // never happened, and everything else is read from the Ledger's own record of it.
  router.post(
    "/rectify",
    requirePermission(Permission.INTENT_SUBMIT),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { targetEventId, description, corrected } = req.body ?? {};
        if (typeof targetEventId !== "string" || targetEventId.trim() === "") {
          res.status(400).json({ error: "targetEventId is required." });
          return;
        }
        // `corrected` turns a withdrawal into a restatement. Only the three fields a correction may
        // restate are read; anything else in the body is ignored rather than trusted, since the rest
        // of the entry is carried over from what the Ledger holds.
        const outcome = await submitRectification.execute({
            targetEventId,
            description,
            corrected: corrected
              ? {
                  amount: typeof corrected.amount === "string" ? corrected.amount : undefined,
                  occurredAt: typeof corrected.occurredAt === "string" ? corrected.occurredAt : undefined,
                  description:
                    typeof corrected.description === "string" ? corrected.description : undefined,
                }
              : undefined,
            userId: currentUser(req).id,
        });

        // A correction writes up to two events, both on the same position. Forgetting once is
        // enough, and forgetting is all that happens: the fresh figures come from the Ledger.
        for (const step of [outcome.retraction, outcome.reissue]) {
          if (step?.status === "accepted") forgetPositions(movedBy(step));
        }
        res.json(outcome);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
