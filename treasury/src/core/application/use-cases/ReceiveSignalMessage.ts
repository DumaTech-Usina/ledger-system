import { parseSignalMessage } from "../messaging/insuranceSignalMessage";
import type { RegisterExternalSignalUseCase } from "./RegisterExternalSignal";

export type ReceiveOutcome =
  | { outcome: "registered"; messageId: string; signalId: string }
  | { outcome: "duplicate"; messageId: string }
  | { outcome: "invalid"; reason: string };

/**
 * The consumer's decision for one message, independent of the broker: `registered` and `duplicate`
 * are acknowledged; `invalid` goes to the dead-letter queue with its reason. The fields are checked by
 * the same rule the form obeys, inside the use case.
 */
export class ReceiveSignalMessageUseCase {
  constructor(private readonly register: RegisterExternalSignalUseCase) {}

  async execute(raw: string): Promise<ReceiveOutcome> {
    const parsed = parseSignalMessage(raw);
    if (!parsed.ok) return { outcome: "invalid", reason: parsed.reason };
    const { message } = parsed;
    try {
      const result = await this.register.execute({
        kind: message.signal.kind,
        fields: message.signal.fields,
        userId: "",
        bySystem: true,
      });
      return result.duplicate
        ? { outcome: "duplicate", messageId: message.messageId }
        : { outcome: "registered", messageId: message.messageId, signalId: result.signal.id };
    } catch (err) {
      return { outcome: "invalid", reason: err instanceof Error ? err.message : String(err) };
    }
  }
}
