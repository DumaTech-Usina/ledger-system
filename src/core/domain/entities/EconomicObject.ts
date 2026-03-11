import { ObjectNature } from "../enums/ObjectNature";
import { ObjectType } from "../enums/ObjectType";
import { ObjectId } from "../value-objects/ObjectId";

export class EconomicObject {
  constructor(
    readonly id: ObjectId,
    readonly nature: ObjectNature,
    readonly type: ObjectType,
    readonly externalId: string,
  ) {}
}
