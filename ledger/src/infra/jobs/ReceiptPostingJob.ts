import { ProposalContext } from "../../core/application/dtos/ProposalContext";
import { StagingRecord } from "../../core/application/dtos/StagingRecord";
import { StagingRepository } from "../../core/application/repositories/StagingRepository";
import { ConfidenceLevel } from "../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../core/domain/enums/Direction";
import { EconomicEffect } from "../../core/domain/enums/EconomicEffect";
import { EventType } from "../../core/domain/enums/EventType";
import { ObjectType } from "../../core/domain/enums/ObjectType";
import { PartyRole } from "../../core/domain/enums/PartyRole";
import { ReasonType } from "../../core/domain/enums/ReasonType";
import { Relation } from "../../core/domain/enums/Relation";
import { ReporterType } from "../../core/domain/enums/ReporterType";

export interface ReceiptPostingInput {
  receiptId: string;
  proposalId: string;
  installmentNumber: number;
  downloadedValue: string;
  dischargeDate: string | null;
  receiptStatus: string;
}

export class ReceiptPostingJob {
  constructor(
    private readonly stagingRepo: StagingRepository,
    private readonly usinaPartyId: string,
    private readonly workerId: string,
  ) {}

  async run(
    inputs: ReceiptPostingInput[],
    contexts: Map<string, ProposalContext>,
  ): Promise<void> {
    for (const input of inputs) {
      const record = this.buildCandidate(input, contexts);
      if (record !== null) {
        await this.stagingRepo.save(record);
      }
    }
  }

  private buildCandidate(
    input: ReceiptPostingInput,
    contexts: Map<string, ProposalContext>,
  ): StagingRecord | null {
    if (!isNonEmpty(input.receiptId)) {
      warn("Rejected: receiptId null or empty");
      return null;
    }

    const ctx = contexts.get(input.proposalId);
    if (!ctx) {
      warn(`Rejected receipt ${input.receiptId}: no ProposalContext for proposalId "${input.proposalId}"`);
      return null;
    }

    if (input.receiptStatus !== "BAIXADO" && input.receiptStatus !== "NÃO BAIXADO") {
      warn(`Rejected receipt ${input.receiptId}: unknown receiptStatus "${input.receiptStatus}"`);
      return null;
    }

    if (input.dischargeDate !== null) {
      if (input.receiptStatus !== "BAIXADO") {
        warn(`Rejected receipt ${input.receiptId}: dischargeDate present but receiptStatus is "${input.receiptStatus}"`);
        return null;
      }
      const d = new Date(input.dischargeDate);
      if (isNaN(d.getTime())) {
        warn(`Rejected receipt ${input.receiptId}: dischargeDate is not a valid date`);
        return null;
      }
    } else {
      if (input.receiptStatus !== "NÃO BAIXADO") {
        warn(`Rejected receipt ${input.receiptId}: dischargeDate is null but receiptStatus is "${input.receiptStatus}"`);
        return null;
      }
    }

    const downloadedValue = parseFloat(input.downloadedValue);
    if (!isFinite(downloadedValue) || downloadedValue <= 0) {
      warn(`Rejected receipt ${input.receiptId}: downloadedValue "${input.downloadedValue}" is zero, negative, or non-parseable`);
      return null;
    }

    if (!Number.isInteger(input.installmentNumber) || input.installmentNumber <= 0) {
      warn(`Rejected receipt ${input.receiptId}: installmentNumber must be a positive integer`);
      return null;
    }

    const isBaixado = input.receiptStatus === "BAIXADO";

    return {
      id: crypto.randomUUID(),
      status: "pending",
      eventType: isBaixado ? EventType.COMMISSION_RECEIVED : EventType.COMMISSION_EXPECTED,
      economicEffect: isBaixado ? EconomicEffect.CASH_IN : EconomicEffect.NON_CASH,
      occurredAt: isBaixado ? input.dischargeDate! : ctx.registeredAt.toISOString(),
      sourceAt: input.dischargeDate,
      amount: input.downloadedValue,
      currency: "BRL",
      sourceSystem: "integration",
      sourceReference: `receipt:${input.receiptId}:receivable`,
      normalizationVersion: "1.0",
      normalizationWorkerId: this.workerId,
      parties: isBaixado ? buildCashInParties(ctx.operatorId, this.usinaPartyId, input.downloadedValue)
                         : buildNonCashParties(ctx.operatorId, this.usinaPartyId),
      objects: buildObjects(input.receiptId, ctx, input.installmentNumber, isBaixado),
      reason: {
        type: isBaixado ? ReasonType.COMMISSION_PAYMENT : ReasonType.LATE_IDENTIFIED_COMMISSION,
        description: "Receipt receivable recognition",
        confidence: ConfidenceLevel.MEDIUM,
        requiresFollowup: false,
      },
      reporter: {
        reporterType: ReporterType.SYSTEM,
        reporterId: "receipt-posting-job",
        channel: "batch-integration",
      },
    };
  }
}

function buildCashInParties(
  operatorId: string,
  usinaPartyId: string,
  downloadedValue: string,
): StagingRecord["parties"] {
  return [
    { partyId: operatorId, role: PartyRole.PAYER, direction: Direction.OUT },
    { partyId: usinaPartyId, role: PartyRole.PAYEE, direction: Direction.IN, amount: downloadedValue },
  ];
}

function buildNonCashParties(
  operatorId: string,
  usinaPartyId: string,
): StagingRecord["parties"] {
  return [
    { partyId: operatorId, role: PartyRole.PAYER, direction: Direction.NEUTRAL },
    { partyId: usinaPartyId, role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
  ];
}

function buildObjects(
  receiptId: string,
  ctx: ProposalContext,
  installmentNumber: number,
  isBaixado: boolean,
): StagingRecord["objects"] {
  return [
    {
      objectId: `receivable:${receiptId}`,
      objectType: ObjectType.COMMISSION_RECEIVABLE,
      relation: isBaixado ? Relation.SETTLES : Relation.ORIGINATES,
    },
    {
      objectId: ctx.proposalId,
      objectType: ObjectType.PROPOSAL,
      relation: Relation.REFERENCES,
    },
    {
      objectId: `${ctx.proposalId}:${installmentNumber}`,
      objectType: ObjectType.INSTALLMENT,
      relation: Relation.REFERENCES,
    },
    {
      objectId: ctx.planId,
      objectType: ObjectType.CONTRACT,
      relation: Relation.REFERENCES,
    },
  ];
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function warn(message: string): void {
  console.warn(`[ReceiptPostingJob] ${message}`);
}
