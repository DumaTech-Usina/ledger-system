import { ObjectType } from "../enums/ObjectType";
import { Relation } from "../enums/Relation";
import { ObjectId } from "../value-objects/ObjectId";

export class LedgerEventObject {
  constructor(
    public readonly objectId: ObjectId,
    public readonly objectType: ObjectType,
    public readonly relation: Relation,
  ) {}
}
