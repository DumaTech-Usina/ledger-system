import { SlotType } from "../enums/SlotType";
import type { SlotDefinition } from "../value-objects/Slot";

/**
 * The institutions the Usina's money is kept in (§8.6 REQ-650, §8.8 REQ-674–676).
 *
 * A configuration, not a registry of facts: the list comes from `CASH_INSTITUTIONS` (`key=Name`) and
 * adding one is adding a pair and restarting. The key is written into facts (`instituicao:<key>`) and
 * never changes once used; the name can.
 */
export interface Institution {
  key: string;
  name: string;
}

/** What `CASH_INSTITUTIONS` holds when it is not set. */
export const DEFAULT_CASH_INSTITUTIONS = "bradesco=Bradesco,itau=Itaú,corretora=Corretora de investimentos";

/** The explicit answer "the institution was not stated" (REQ-674): never an assumption, never blank. */
export const NOT_STATED = "nao_informada";
export const NOT_STATED_LABEL = "Não informada";

/** Reads `key=Name,key=Name`. Refuses a key that could not be part of an object id, or one given twice. */
export function institutionsFrom(raw: string): Institution[] {
  const list = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, ...name] = pair.split("=");
      return { key: key.trim(), name: name.join("=").trim() };
    });
  for (const { key, name } of list) {
    if (!/^[a-z0-9-]+$/.test(key) || !name) throw new Error(`CASH_INSTITUTIONS: "${key}=${name}" is not key=Name with a key in a-z, 0-9 and -.`);
    if (key === NOT_STATED) throw new Error(`CASH_INSTITUTIONS: "${NOT_STATED}" is the answer "not stated", not an institution.`);
  }
  if (new Set(list.map((i) => i.key)).size !== list.length) throw new Error("CASH_INSTITUTIONS: a key appears twice.");
  return list;
}

export const INSTITUTION_PREFIX = "instituicao:";

/** The context a cash fact cites to say where the money moved (REQ-650, DEC-044). */
export const institutionContext = (key: string) => ({ objectId: `${INSTITUTION_PREFIX}${key}`, objectType: "cash_account" });

/** The key of an institution's object id, or null when the id is not one. */
export const institutionKeyOf = (objectId: string): string | null =>
  objectId.startsWith(INSTITUTION_PREFIX) ? objectId.slice(INSTITUTION_PREFIX.length) : null;

/**
 * REQ-674: every conversation that moves money asks where. "Não informada" is among the choices, so
 * the question is always answered — explicitly — and never filled in by the system.
 */
export const INSTITUTION_SLOT: SlotDefinition = {
  key: "institution",
  type: SlotType.CHOICE,
  prompt: "In which institution did the money move?",
  required: true,
};

/** The institution an opening balance is of (REQ-670): one of the list, never "not stated". */
export const OPENING_INSTITUTION_SLOT: SlotDefinition = {
  key: "institution",
  type: SlotType.CHOICE,
  prompt: "Which institution's statement is this?",
  required: true,
};

/** Where a transfer left from, and where it arrived (REQ-672). */
export const TRANSFER_FROM_SLOT: SlotDefinition = {
  key: "fromInstitution",
  type: SlotType.CHOICE,
  prompt: "From which institution did the money leave?",
  required: true,
};
export const TRANSFER_TO_SLOT: SlotDefinition = {
  key: "toInstitution",
  type: SlotType.CHOICE,
  prompt: "In which institution did it arrive?",
  required: true,
};

let configured: Institution[] = [];

/**
 * Sets the list every institution question offers. Called once at boot with `CASH_INSTITUTIONS`; the
 * slots are shared by the scenarios, so the choices and their labels follow the configuration.
 */
export function configureInstitutions(list: Institution[]): void {
  configured = list.map((i) => ({ ...i }));
  const keys = configured.map((i) => i.key);
  const labels = Object.fromEntries(configured.map((i) => [i.key, i.name]));
  INSTITUTION_SLOT.choices = [...keys, NOT_STATED];
  INSTITUTION_SLOT.choiceLabels = { ...labels, [NOT_STATED]: NOT_STATED_LABEL };
  for (const slot of [OPENING_INSTITUTION_SLOT, TRANSFER_FROM_SLOT, TRANSFER_TO_SLOT]) {
    slot.choices = [...keys];
    slot.choiceLabels = { ...labels };
  }
}

export function configuredInstitutions(): Institution[] {
  return configured.map((i) => ({ ...i }));
}

configureInstitutions(institutionsFrom(DEFAULT_CASH_INSTITUTIONS));
