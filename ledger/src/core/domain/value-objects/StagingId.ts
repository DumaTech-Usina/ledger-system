export class StagingId {
  constructor(readonly value: string) {
    if (!value?.trim()) throw new Error("StagingId is required");
  }
}
