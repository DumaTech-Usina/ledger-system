import { Direction } from "../enums/Direction";
import { PartyRole } from "../enums/PartyRole";
import { Money } from "../value-objects/Money";
import { PartyId } from "../value-objects/PartyId";

export class LedgerEventParty {
  constructor(
    public readonly partyId: PartyId,
    public readonly role: PartyRole,
    public readonly direction: Direction,
    public readonly amount: Money | null,
  ) {}
}
