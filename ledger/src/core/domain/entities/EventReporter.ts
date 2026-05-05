import { ReporterType } from "../enums/ReporterType";

export class EventReporter {
  constructor(
    readonly reporterType: ReporterType,
    readonly reporterId: string,
    readonly reporterName: string | null,
    readonly reportedAt: Date,
    readonly channel: string,
  ) {}
}
