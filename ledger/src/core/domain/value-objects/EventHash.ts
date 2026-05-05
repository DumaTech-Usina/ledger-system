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
    if (Array.isArray(obj)) {
      return "[" + obj.map(EventHash.canonicalize).join(",") + "]";
    }
    if (obj !== null && typeof obj === "object") {
      const pairs = Object.keys(obj)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + EventHash.canonicalize(obj[k]));
      return "{" + pairs.join(",") + "}";
    }
    return JSON.stringify(obj);
  }
}
