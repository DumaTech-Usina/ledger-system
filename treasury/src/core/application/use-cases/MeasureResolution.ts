import type { ResolutionCandidate } from "../../domain/services/PartyResolution";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";

export interface ResolutionMeasurement {
  total: number;
  /** Resolved by an exact match — no turn is spent. */
  exact: number;
  /** Close names were found — costs a choice turn. */
  similar: number;
  /** Nothing matched. */
  unresolved: number;
  similarSamples: { mention: string; candidates: ResolutionCandidate[] }[];
  unresolvedSamples: string[];
}

const SAMPLE_LIMIT = 10;

/**
 * Runs the cascade over a corpus of mentions and reports the outcome distribution. It decides
 * nothing and stores nothing — it exists so the threshold and the readiness of the Directory are
 * settled by a number rather than by an impression.
 */
export class MeasureResolutionUseCase {
  constructor(private readonly directory: PartyDirectoryPort) {}

  async execute(mentions: string[]): Promise<ResolutionMeasurement> {
    const measurement: ResolutionMeasurement = {
      total: mentions.length,
      exact: 0,
      similar: 0,
      unresolved: 0,
      similarSamples: [],
      unresolvedSamples: [],
    };

    for (const mention of mentions) {
      const resolution = await this.directory.resolve({ mention });

      switch (resolution.kind) {
        case "resolved":
          measurement.exact += 1;
          break;
        case "similar":
          measurement.similar += 1;
          if (measurement.similarSamples.length < SAMPLE_LIMIT) {
            measurement.similarSamples.push({ mention, candidates: resolution.candidates });
          }
          break;
        case "new":
          measurement.unresolved += 1;
          if (measurement.unresolvedSamples.length < SAMPLE_LIMIT) {
            measurement.unresolvedSamples.push(mention);
          }
          break;
      }
    }

    return measurement;
  }
}
