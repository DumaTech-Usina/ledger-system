/**
 * The Ledger's economic algebra, read from the snapshot it exports.
 *
 * Treasury does not import Ledger code and does not restate its rules. It consumes a build artifact
 * produced from the real domain modules (`npm run export:algebra`), whose freshness the Ledger's own
 * suite enforces. What this module adds is the one thing the snapshot cannot carry: the INVERSION.
 *
 * The algebra is declared per event type — "a payroll payment settles a payroll" — because that is
 * how an event is validated. Every question the interface asks runs the other way: given a position,
 * what could happen to it next? Inverting is mechanical, and doing it here is what keeps anyone from
 * writing the answer down by hand, which is how `RECTIFIABLE_OBJECT_TYPES` came to exist.
 */

export interface LedgerAlgebraSnapshot {
  version: number;
  objectNature: Record<string, string>;
  objectRelations: Record<string, string[]>;
  effectRelations: Record<string, string[]>;
  reasonEffects: Record<string, string[]>;
  reasonRelations: Record<string, string[]>;
  contracts: Record<
    string,
    {
      economicEffects: string[];
      objects: { objectType: string; relations: string[] }[];
      reasons: string[];
      minConfidence: string | null;
      requiresPreviousHash: boolean;
      requiresRelatedEventId: boolean;
      allowedOriginTypes: string[];
    }
  >;
}

/**
 * One thing the algebra says may happen to a position of a given kind.
 *
 * Deliberately just the pair. Whether recording it ALSO touches another position is not something
 * the algebra can answer: a contract lists the object types an event may name, without saying
 * whether they are alternatives or companions. `OBLIGATION_RECOGNIZED` lists five and names one of
 * them; `COMMISSION_SPLIT` lists two and names both. Only the producer knows which, so the question
 * is answered where the tuple is built, not here.
 */
export interface AdmissibleAction {
  eventType: string;
  relation: string;
}

/** The shape version this code understands. A snapshot from the future is refused, not guessed at. */
export const SUPPORTED_SNAPSHOT_VERSION = 1;

export class LedgerAlgebra {
  private readonly byObjectType = new Map<string, AdmissibleAction[]>();

  constructor(private readonly snapshot: LedgerAlgebraSnapshot) {
    if (snapshot.version !== SUPPORTED_SNAPSHOT_VERSION) {
      throw new Error(
        `Ledger algebra snapshot version ${snapshot.version} is not readable by this build ` +
          `(expected ${SUPPORTED_SNAPSHOT_VERSION}).`,
      );
    }
    this.index();
  }

  /**
   * Everything the algebra admits on a position of this kind — the contracts' declaration, read
   * backwards. Nothing here consults state: whether it makes sense NOW is a different question,
   * asked later and by a different layer.
   *
   * An unknown object type yields an empty list, which is honest: the algebra has nothing to say
   * about a kind it does not declare. It is not the same as "nothing is allowed", and callers that
   * would hide an action on that basis are the ones that need to know the difference.
   */
  admissibleFor(objectType: string): AdmissibleAction[] {
    return this.byObjectType.get(objectType) ?? [];
  }

  /** Whether the algebra declares this kind at all — "unknown" told apart from "nothing admitted". */
  knows(objectType: string): boolean {
    return objectType in this.snapshot.objectNature;
  }

  /** Contextual objects are annotated, never moved: they have no lifecycle to evolve. */
  isPositional(objectType: string): boolean {
    return this.snapshot.objectNature[objectType] === "positional";
  }

  private index(): void {
    for (const [eventType, contract] of Object.entries(this.snapshot.contracts)) {
      for (const object of contract.objects) {
        const actions = this.byObjectType.get(object.objectType) ?? [];
        for (const relation of object.relations) actions.push({ eventType, relation });
        this.byObjectType.set(object.objectType, actions);
      }
    }
  }
}
