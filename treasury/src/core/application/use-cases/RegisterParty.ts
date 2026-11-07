import type { Party } from "../../domain/entities/Party";
import { AttributeSource } from "../../domain/enums/AttributeSource";
import { AttributeState } from "../../domain/enums/AttributeState";
import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { normalizeDocument } from "../../domain/services/PartyNormalization";
import { PartyAttributeKey, type PartyAttribute } from "../../domain/value-objects/PartyAttribute";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";
import type { PartyRepository } from "../repositories/PartyRepository";

export type PartyKind = "person" | "company";

export interface RegisterPartyInput {
  displayName: string;
  kind: PartyKind;
  /** Whether this party receives or pays through a bank account (REQ-314). */
  hasBankAccount: boolean;
  document?: string;
  userId: string;
}

/** A refusal the person registering can fix. Not a fault. */
export class PartyRegistrationError extends Error {}

const DOCUMENT_LENGTH: Record<PartyKind, number> = { person: 11, company: 14 };

/**
 * Registers a party, which only someone with curation may do (REQ-311, REQ-402; enforced at the route).
 *
 * The document is demanded here and nowhere else (REQ-314). Recording a fact never depends on it: a
 * party that is not registered yet gets a provisional identity instead (REQ-320).
 *
 * Only a person or a company can be registered. The end client of a plan is context of an event, not
 * a party (REQ-313); the system cannot tell who is typed in the name, so this keeps that category out
 * of the registry and leaves the rest to the curator.
 */
export class RegisterPartyUseCase {
  constructor(
    private readonly parties: PartyRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterPartyInput): Promise<Party> {
    const displayName = (input.displayName ?? "").trim();
    if (displayName === "") throw new PartyRegistrationError("A party needs a name.");
    if (input.kind !== "person" && input.kind !== "company") {
      throw new PartyRegistrationError("A party is a person or a company.");
    }

    const document = normalizeDocument(input.document ?? "");
    if (input.hasBankAccount && document === "") {
      throw new PartyRegistrationError("A party with a bank account needs a CPF or CNPJ.");
    }
    if (document !== "" && document.length !== DOCUMENT_LENGTH[input.kind]) {
      throw new PartyRegistrationError(
        input.kind === "person" ? "A CPF has 11 digits." : "A CNPJ has 14 digits.",
      );
    }

    const existing = await this.parties.findAll();
    if (
      document !== "" &&
      existing.some((p) => {
        const held = p.attributes[PartyAttributeKey.DOCUMENT]?.value;
        return held !== undefined && normalizeDocument(held) === document;
      })
    ) {
      throw new PartyRegistrationError("Another party already has this document.");
    }

    const now = this.clock.now();
    const attribute = (value: string): PartyAttribute => ({
      state: AttributeState.KNOWN,
      value,
      source: AttributeSource.USER,
      confidence: 1,
      capturedAt: now,
      capturedBy: input.userId,
    });

    const party: Party = {
      partyId: `party-${this.ids.next()}`,
      identityState: PartyIdentityState.IDENTIFIED,
      displayName,
      aliases: [],
      externalIds: [],
      attributes: {
        [PartyAttributeKey.TYPE]: attribute(input.kind),
        [PartyAttributeKey.BANK_ACCOUNT]: attribute(input.hasBankAccount ? "yes" : "no"),
        ...(document === "" ? {} : { [PartyAttributeKey.DOCUMENT]: attribute(document) }),
      },
      createdBy: input.userId,
      createdAt: now,
    };
    await this.parties.save(party);
    return party;
  }
}
