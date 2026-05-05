import { ConfidenceLevel } from "../enums/ConfidenceLevel";
import { ReasonType } from "../enums/ReasonType";

export class EventReason {
  constructor(
    readonly type: ReasonType,
    readonly description: string,
    readonly confidence: ConfidenceLevel,
    readonly requiresFollowup: boolean,
  ) {}
}
