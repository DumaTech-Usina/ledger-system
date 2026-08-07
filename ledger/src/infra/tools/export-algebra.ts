import { writeFileSync } from "fs";
import { join } from "path";
import { EVENT_CONTRACTS } from "../../core/domain/contracts/EventContract";
import {
  ECONOMIC_EFFECT_RELATION_MATRIX,
  OBJECT_NATURE_MATRIX,
  OBJECT_RELATION_MATRIX,
  REASON_EFFECT_MATRIX,
  REASON_RELATION_MATRIX,
} from "../../core/domain/policies/FormalMatrices";

/**
 * Exports the Ledger's economic algebra as a downstream snapshot.
 *
 * The hand-authored master stays where it belongs — `FormalMatrices.ts` and `EventContract.ts`, in
 * the sovereign domain layer. This reads those real modules and serializes them, so the snapshot
 * cannot disagree with the source: there is no second declaration to keep in step, only a
 * projection of the first.
 *
 * It exists because consumers need to ANSWER questions the algebra already answers — "can this kind
 * of event touch this kind of position?" — without a hand-written copy of the answer. Every such
 * copy made so far has drifted; `RECTIFIABLE_OBJECT_TYPES` in the Treasury client is the live
 * example, and it exists only because there was nothing to derive from.
 *
 * The snapshot is a BUILD ARTIFACT, never a source of truth. `algebra-freshness.test.ts` fails the
 * suite when it falls behind, which is what keeps that distinction real rather than aspirational.
 */

/** Bumped when the SHAPE changes, so a consumer can refuse a snapshot it cannot read. */
export const ALGEBRA_SNAPSHOT_VERSION = 1;

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

/** Sorted on the way out: a snapshot whose diff depends on declaration order is a noisy one. */
function sortedMap(source: Record<string, readonly string[] | undefined>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    if (value) out[key] = [...value];
  }
  return out;
}

export function buildAlgebraSnapshot(): LedgerAlgebraSnapshot {
  const contracts: LedgerAlgebraSnapshot["contracts"] = {};
  for (const eventType of Object.keys(EVENT_CONTRACTS).sort()) {
    const contract = EVENT_CONTRACTS[eventType as keyof typeof EVENT_CONTRACTS];
    contracts[eventType] = {
      economicEffects: [...contract.economicEffects],
      objects: contract.objects.map((o) => ({
        objectType: o.objectType,
        relations: [...o.relations],
      })),
      reasons: contract.reasons ? [...contract.reasons] : [],
      minConfidence: contract.minConfidence ?? null,
      requiresPreviousHash: contract.requiresPreviousHash === true,
      requiresRelatedEventId: contract.requiresRelatedEventId === true,
      allowedOriginTypes: contract.allowedOriginTypes ? [...contract.allowedOriginTypes] : [],
    };
  }

  return {
    version: ALGEBRA_SNAPSHOT_VERSION,
    objectNature: Object.fromEntries(
      Object.keys(OBJECT_NATURE_MATRIX)
        .sort()
        .map((k) => [k, OBJECT_NATURE_MATRIX[k as keyof typeof OBJECT_NATURE_MATRIX]]),
    ),
    objectRelations: sortedMap(OBJECT_RELATION_MATRIX),
    effectRelations: sortedMap(ECONOMIC_EFFECT_RELATION_MATRIX),
    reasonEffects: sortedMap(REASON_EFFECT_MATRIX),
    reasonRelations: sortedMap(REASON_RELATION_MATRIX),
    contracts,
  };
}

export const ALGEBRA_SNAPSHOT_PATH = join(__dirname, "..", "..", "..", "algebra.json");

export function serializeAlgebraSnapshot(): string {
  return `${JSON.stringify(buildAlgebraSnapshot(), null, 2)}\n`;
}

if (require.main === module) {
  writeFileSync(ALGEBRA_SNAPSHOT_PATH, serializeAlgebraSnapshot());
  // eslint-disable-next-line no-console
  console.log(`algebra snapshot written to ${ALGEBRA_SNAPSHOT_PATH}`);
}
