import type { ExternalSignalProps, ProposedFact } from "../../domain/entities/ExternalSignal";
import type { IntentStatus } from "../../domain/enums/IntentStatus";
import type { ExternalSignalRepository } from "../repositories/ExternalSignalRepository";
import type { IntentRepository } from "../repositories/IntentRepository";

export interface SignalProposalView extends ProposedFact {
  /** Where the proposal stands now, read from its intent — never stored on the signal. */
  intentStatus: IntentStatus | null;
  ledgerReference?: string;
}

export interface SignalView extends Omit<ExternalSignalProps, "proposals"> {
  proposals: SignalProposalView[];
}

/** The signals received, most recent first, each proposal with its current state. */
export class ListExternalSignalsUseCase {
  constructor(
    private readonly signals: ExternalSignalRepository,
    private readonly intents: IntentRepository,
  ) {}

  async execute(): Promise<SignalView[]> {
    const signals = await this.signals.list();
    return Promise.all(
      signals.map(async (signal) => {
        const props = signal.toJSON();
        const proposals = await Promise.all(
          props.proposals.map(async (p) => {
            const intent = await this.intents.findById(p.intentId);
            return {
              ...p,
              intentStatus: intent?.status ?? null,
              ...(intent?.ledgerReference ? { ledgerReference: intent.ledgerReference } : {}),
            };
          }),
        );
        return { ...props, proposals };
      }),
    );
  }
}
