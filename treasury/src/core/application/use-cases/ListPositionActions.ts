import { producibleTuples } from "../services/CandidateMapper";
import type { LedgerAlgebra } from "../services/LedgerAlgebra";
import type { PositionLifecyclePort } from "../ports/PositionLifecyclePort";

/** One thing the operator can record about this position. */
export interface PositionAction {
  scenarioId: string;
  eventType: string;
  relation: string;
  /** The variant answer a selection implies, when the scenario branches. */
  variantChoice?: string;
  /**
   * True when recording this ALSO touches a position other than this one. The interface has to say
   * which of the two is happening instead of presenting both as "evolving this position".
   */
  touchesOtherPositions: boolean;
  /**
   * Whether this is the likely thing to do now, given the position's figures. It orders the list and
   * nothing else: an action is NEVER hidden for being unlikely, because the operator may know a
   * fact the book does not yet hold.
   */
  likely: boolean;
}

export interface ListPositionActionsResult {
  objectId: string;
  objectType: string;
  /** False when the algebra does not declare this kind at all — unknown, not "nothing allowed". */
  known: boolean;
  actions: PositionAction[];
}

/**
 * What can be recorded about a position, derived rather than declared.
 *
 * Two sources meet here and neither is a list anyone maintains:
 *
 *   - the Ledger's algebra, inverted — what MAY touch a position of this kind;
 *   - treasury's own mappings — what treasury can actually produce.
 *
 * Their intersection is the offer. Adding a position type that reuses existing events costs nothing
 * here; adding an event costs one scenario and one mapping, and the offer follows. Nothing grows
 * per pair of (type × action), which is the whole point: that product is what turns into a wall of
 * `if (objectType === ...)` once the domain has twenty types.
 *
 * ## What this deliberately does not do
 *
 * It does not decide validity. The Ledger owns that, and answers at submission with a typed
 * rejection. Offering something that gets refused costs a round trip; hiding something that would
 * have been accepted costs the operator a fact they cannot record — so the ranking orders, and the
 * filtering never removes. Conservation, lineage and over-settlement are not consulted here at all:
 * they read other events, and reproducing them would be a second implementation of a rule the
 * Ledger already owns.
 */
export class ListPositionActionsUseCase {
  constructor(
    private readonly lifecycle: PositionLifecyclePort,
    private readonly algebra: LedgerAlgebra,
  ) {}

  async execute(objectId: string): Promise<ListPositionActionsResult | null> {
    const position = await this.lifecycle.lifecycle(objectId);
    if (!position) return null;

    const { objectType } = position;
    const admissible = this.algebra.admissibleFor(objectType);
    const admits = (eventType: string, relation: string) =>
      admissible.some((a) => a.eventType === eventType && a.relation === relation);

    // Relevance, not validity. Both read figures the Ledger published — never `status`, which says
    // "open" for a cash-basis position that has nothing pending.
    const hasOutstanding = position.openBalance !== null && Number(position.openBalance) > 0;
    const nothingOriginated = Number(position.totalOriginated) === 0;

    const actions = producibleTuples()
      .filter((tuple) => tuple.objectType === objectType && admits(tuple.eventType, tuple.relation))
      .map((tuple) => ({
        scenarioId: tuple.scenarioId,
        eventType: tuple.eventType,
        relation: tuple.relation,
        ...(tuple.variantChoice ? { variantChoice: tuple.variantChoice } : {}),
        touchesOtherPositions: tuple.touchesOtherPositions,
        likely: isLikely(tuple.relation, { hasOutstanding, nothingOriginated }),
      }));

    // Likely first, then stable by scenario so the order never depends on object iteration.
    actions.sort((a, b) =>
      a.likely === b.likely ? a.scenarioId.localeCompare(b.scenarioId) : a.likely ? -1 : 1,
    );

    return { objectId, objectType, known: this.algebra.knows(objectType), actions };
  }
}

/**
 * Closing something is likely while something is outstanding; opening one is likely while nothing
 * has been originated — which is exactly the shape a payment recorded on its own leaves behind,
 * waiting for what established it.
 */
function isLikely(
  relation: string,
  state: { hasOutstanding: boolean; nothingOriginated: boolean },
): boolean {
  if (relation === "settles" || relation === "adjusts") return state.hasOutstanding;
  if (relation === "originates") return state.nothingOriginated;
  return false;
}
