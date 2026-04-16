import crypto from "crypto";

export class EventHash {
  private constructor(public readonly value: string) {}

  static fromValue(value: string): EventHash {
    return new EventHash(value);
  }

  static generateCanonical(data: any): EventHash {
    const canonical = EventHash.canonicalize(data);

    const hash = crypto.createHash("sha256").update(canonical).digest("hex");

    return new EventHash(hash);
  }

  private static canonicalize(obj: any): string {
    return JSON.stringify(obj, Object.keys(obj).sort());
  }
}
