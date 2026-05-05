export class EventSource {
  constructor(
    public readonly system: string,
    public readonly reference: string,
  ) {
    if (!system) throw new Error("Source system required");
    if (!reference) throw new Error("Source reference required");
  }
}
