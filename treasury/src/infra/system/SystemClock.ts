import type { Clock } from "../../core/application/ports/Clock";

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
