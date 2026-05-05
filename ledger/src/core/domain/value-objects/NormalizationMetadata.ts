export class NormalizationMetadata {
  constructor(
    public readonly version: string,
    public readonly workerId: string,
  ) {
    if (!version) throw new Error("Normalization version required");
    if (!workerId) throw new Error("Worker id required");
  }
}
