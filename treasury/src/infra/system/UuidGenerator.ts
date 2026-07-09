import { randomUUID } from "crypto";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
