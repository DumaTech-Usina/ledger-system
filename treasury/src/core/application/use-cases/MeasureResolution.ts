import type { ResolutionCandidate } from "../../domain/services/PartyResolution";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";

export interface ResolutionMeasurement {
  total: number;
  /** Resolved by an exact rung — no turn is spent. */
  exact: number;
  /** Resolved by similarity — costs a light confirmation turn. */
  needsConfirmation: number;
  /** Several candidates cleared the threshold — costs a choice turn. */
  ambiguous: number;
  /** Nothing matched — would become an explicit creation decision. */
  unresolved: number;
  ambiguousSamples: { mention: string; candidates: ResolutionCandidate[] }[];
  unresolvedSamples: string[];
}

const SAMPLE_LIMIT = 10;

/**
 * Runs the cascade over a corpus of mentions and reports the outcome distribution. It decides
 * nothing and stores nothing — it exists so the threshold and the readiness of the Directory are
 * settled by a number rather than by an impression.
 *
 * The `ambiguous` rate is the figure that gates turning the barrier on: a directory that resolves
 * poorly would turn every conversation into a creation prompt, which is the failure mode the
 * barrier is meant to prevent.
 */
export class MeasureResolutionUseCase {
  constructor(private readonly directory: PartyDirectoryPort) {}

  async execute(mentions: string[]): Promise<ResolutionMeasurement> {
    const measurement: ResolutionMeasurement = {
      total: mentions.length,
      exact: 0,
      needsConfirmation: 0,
      ambiguous: 0,
      unresolved: 0,
      ambiguousSamples: [],
      unresolvedSamples: [],
    };

    for (const mention of mentions) {
      const resolution = await this.directory.resolve({ mention });

      switch (resolution.kind) {
        case "resolved":
          if (resolution.needsConfirmation) measurement.needsConfirmation += 1;
          else measurement.exact += 1;
          break;
        case "ambiguous":
          measurement.ambiguous += 1;
          if (measurement.ambiguousSamples.length < SAMPLE_LIMIT) {
            measurement.ambiguousSamples.push({ mention, candidates: resolution.candidates });
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
