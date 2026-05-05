import { PartyStatus } from "../enums/PartyStatus";
import { PartyType } from "../enums/PartyType";
import { PartyId } from "../value-objects/PartyId";

export class Party {
  constructor(
    readonly id: PartyId,
    readonly type: PartyType,
    readonly name: string,
    readonly externalId?: string,
    readonly status?: PartyStatus,
  ) {}
}
