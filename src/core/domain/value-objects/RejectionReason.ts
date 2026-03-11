import { RejectionType } from "./RejectionType";

export class RejectionReason {
  constructor(
    readonly type: RejectionType,
    readonly description: string,
  ) {
    if (!description?.trim()) throw new Error("Description is required");
  }
}
