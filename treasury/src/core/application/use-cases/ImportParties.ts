import type { Party } from "../../domain/entities/Party";
import { AttributeSource } from "../../domain/enums/AttributeSource";
import { AttributeState } from "../../domain/enums/AttributeState";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { normalizeName } from "../../domain/services/PartyNormalization";
import { PartyAttributeKey, type PartyAttribute } from "../../domain/value-objects/PartyAttribute";
import type { Clock } from "../ports/Clock";
import type { PartySeed, PartySeedSource } from "../ports/PartySeedSource";
import type { PartyRepository } from "../repositories/PartyRepository";

export interface ImportPartiesResult {
  system: string;
  /** Seeds the source handed over. */
  seen: number;
  /** Parties that did not exist in the Directory yet. */
  created: number;
  /** Existing parties that gained an alias, an external id or an attribute. */
  enriched: number;
  /** Existing parties the source added nothing to. */
  unchanged: number;
  aliasesAdded: number;
}

/**
 * Seeds the Directory from a source that already knows these parties. Runs outside the conversation
 * and changes no behaviour: it only gives the cascade something to resolve against.
 *
 * Two properties matter more than the mechanics:
 *  - **Nothing is minted.** Every seed brings its own id, so this cannot put a PartyId into the
 *    world before the Directory is durable.
 *  - **Nothing is overwritten.** A known attribute keeps its value and a display name is never
 *    replaced; a differing name descends to the aliases instead. An import adds knowledge, it does
 *    not assert that what was already known is wrong.
 *
 * Re-running the same source is therefore idempotent.
 */
export class ImportPartiesUseCase {
  constructor(
    private readonly repo: PartyRepository,
    private readonly clock: Clock,
  ) {}

  async execute(source: PartySeedSource): Promise<ImportPartiesResult> {
    const seeds = await source.fetch();
    const now = this.clock.now();
    const result: ImportPartiesResult = {
      system: source.system,
      seen: seeds.length,
      created: 0,
      enriched: 0,
      unchanged: 0,
      aliasesAdded: 0,
    };

    for (const seed of seeds) {
      const existing = await this.repo.findById(seed.partyId);

      if (!existing) {
        const party = this.build(seed, source.system, now);
        await this.repo.save(party);
        result.created += 1;
        result.aliasesAdded += party.aliases.length;
        continue;
      }

      const merged = this.enrich(existing, seed, source.system, now);
      if (merged.changed) {
        await this.repo.save(merged.party);
        result.enriched += 1;
        result.aliasesAdded += merged.aliasesAdded;
      } else {
        result.unchanged += 1;
      }
    }

    return result;
  }

  private build(seed: PartySeed, system: string, now: string): Party {
    const displayName = seed.displayName;
    const aliases: string[] = [];
    for (const alias of seed.aliases ?? []) {
      addAlias(aliases, displayName, alias);
    }

    return {
      partyId: seed.partyId,
      identityState: PartyIdentityState.IDENTIFIED,
      displayName,
      aliases,
      externalIds: (seed.externalIds ?? []).map((e) => ({ ...e })),
      attributes: this.attributesOf(seed, system, now),
    };
  }

  private enrich(
    party: Party,
    seed: PartySeed,
    system: string,
    now: string,
  ): { party: Party; changed: boolean; aliasesAdded: number } {
    const aliases = [...party.aliases];
    let aliasesAdded = 0;

    // A differing name is a new way this party has been referred to, not a correction of the old
    // one. It becomes an alias so both forms keep resolving.
    for (const candidate of [seed.displayName, ...(seed.aliases ?? [])]) {
      if (addAlias(aliases, party.displayName, candidate)) aliasesAdded += 1;
    }

    const externalIds = [...party.externalIds];
    let externalIdsAdded = 0;
    for (const external of seed.externalIds ?? []) {
      const already = externalIds.some((e) => e.system === external.system && e.value === external.value);
      if (!already) {
        externalIds.push({ ...external });
        externalIdsAdded += 1;
      }
    }

    // Only fills gaps: an attribute that is already KNOWN or DECLINED is left exactly as it is.
    const attributes = { ...party.attributes };
    let attributesAdded = 0;
    for (const [key, attribute] of Object.entries(this.attributesOf(seed, system, now))) {
      if (attributes[key] === undefined) {
        attributes[key] = attribute;
        attributesAdded += 1;
      }
    }

    return {
      party: { ...party, aliases, externalIds, attributes },
      changed: aliasesAdded + externalIdsAdded + attributesAdded > 0,
      aliasesAdded,
    };
  }

  private attributesOf(seed: PartySeed, system: string, now: string): Record<string, PartyAttribute> {
    const attributes: Record<string, PartyAttribute> = {};
    const imported = (value: string): PartyAttribute => ({
      state: AttributeState.KNOWN,
      value,
      source: AttributeSource.IMPORT,
      confidence: 1,
      capturedAt: now,
      capturedBy: system,
    });

    if (seed.document) attributes[PartyAttributeKey.DOCUMENT] = imported(seed.document);
    if (seed.type) attributes[PartyAttributeKey.TYPE] = imported(seed.type);
    return attributes;
  }
}

/**
 * Adds an alias unless it is blank or already resolvable — either as the display name or as an
 * existing alias, compared on the normalized key so "Alfa Ltda." does not join "Alfa".
 */
function addAlias(aliases: string[], displayName: string, candidate: string): boolean {
  const key = normalizeName(candidate);
  if (key === "") return false;
  if (key === normalizeName(displayName)) return false;
  if (aliases.some((a) => normalizeName(a) === key)) return false;
  aliases.push(candidate);
  return true;
}
