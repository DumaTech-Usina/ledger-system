export class EventId {
  constructor(readonly value: string) {
    if (!value) throw new Error("Invalid EventId");
  }
}
