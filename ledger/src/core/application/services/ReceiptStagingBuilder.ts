import { EnrichedReceiptInput } from "../dtos/EnrichedReceiptInput";
import { StagingRecord } from "../dtos/StagingRecord";
import { StagingRepository } from "../repositories/StagingRepository";
import { ConfidenceLevel } from "../../domain/enums/ConfidenceLevel";
import { Direction } from "../../domain/enums/Direction";
import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { EventType } from "../../domain/enums/EventType";
import { ObjectType } from "../../domain/enums/ObjectType";
import { PartyRole } from "../../domain/enums/PartyRole";
import { ReasonType } from "../../domain/enums/ReasonType";
import { Relation } from "../../domain/enums/Relation";
import { ReporterType } from "../../domain/enums/ReporterType";
import { isNonEmpty } from "../utils/guards";

export class ReceiptStagingBuilder {
  constructor(
    private readonly stagingRepo: StagingRepository,
    private readonly usinaPartyId: string,
    private readonly workerId: string,
    private readonly warn: (message: string) => void = () => {},
  ) {}

  async run(inputs: EnrichedReceiptInput[]): Promise<void> {
    for (const input of inputs) {
      const record = this.buildCandidate(input);
      if (record !== null) {
        await this.stagingRepo.save(record);
      }
    }
  }

  private buildCandidate(input: EnrichedReceiptInput): StagingRecord | null {
    if (!isNonEmpty(input.receiptId)) {
      this.warn("Rejected: receiptId null or empty");
      return null;
    }

    // Proposal field guards — these fire only if MongoDB yields a corrupt proposal
    // document (e.g., missing required fields despite status=CLEAN).
    if (!isNonEmpty(input.operatorId)) {
      this.warn(
        `Rejected receipt ${input.receiptId}: operatorId null or empty`,
      );
      return null;
    }
    if (!isNonEmpty(input.proposalNumber)) {
      this.warn(
        `Rejected receipt ${input.receiptId}: proposalNumber null or empty`,
      );
      return null;
    }
    const registeredAt = new Date(input.registeredAt);
    if (isNaN(registeredAt.getTime())) {
      this.warn(
        `Rejected receipt ${input.receiptId}: registeredAt is not a valid date`,
      );
      return null;
    }

    const DISCHARGED = "BAIXADO";
    const NOT_DISCHARGED = new Set(["NÃO BAIXADO", "ABERTA"]);

    if (
      input.receiptStatus !== DISCHARGED &&
      !NOT_DISCHARGED.has(input.receiptStatus)
    ) {
      this.warn(
        `Rejected receipt ${input.receiptId}: unknown receiptStatus "${input.receiptStatus}"`,
      );
      return null;
    }

    if (input.dischargeDate !== null) {
      if (input.receiptStatus !== DISCHARGED) {
        this.warn(
          `Rejected receipt ${input.receiptId}: dischargeDate present but receiptStatus is "${input.receiptStatus}"`,
        );
        return null;
      }
      const d = new Date(input.dischargeDate);
      if (isNaN(d.getTime())) {
        this.warn(
          `Rejected receipt ${input.receiptId}: dischargeDate is not a valid date`,
        );
        return null;
      }
    } else {
      if (!NOT_DISCHARGED.has(input.receiptStatus)) {
        this.warn(
          `Rejected receipt ${input.receiptId}: dischargeDate is null but receiptStatus is "${input.receiptStatus}"`,
        );
        return null;
      }
    }

    if (
      !Number.isInteger(input.installmentNumber) ||
      input.installmentNumber <= 0
    ) {
      this.warn(
        `Rejected receipt ${input.receiptId}: installmentNumber must be a positive integer`,
      );
      return null;
    }

    const isBaixado = input.receiptStatus === DISCHARGED;

    const downloadedValue = parseFloat(input.downloadedValue);
    if (isBaixado && (!isFinite(downloadedValue) || downloadedValue <= 0)) {
      this.warn(
        `Rejected receipt ${input.receiptId}: downloadedValue "${input.downloadedValue}" is zero, negative, or non-parseable`,
      );
      return null;
    }

    return {
      id: crypto.randomUUID(),
      status: "pending",
      eventType: isBaixado
        ? EventType.COMMISSION_RECEIVED
        : EventType.COMMISSION_EXPECTED,
      economicEffect: isBaixado
        ? EconomicEffect.CASH_IN
        : EconomicEffect.NON_CASH,
      occurredAt: isBaixado ? input.dischargeDate! : registeredAt.toISOString(),
      sourceAt: input.dischargeDate,
      amount:
        isFinite(downloadedValue) && downloadedValue > 0
          ? input.downloadedValue
          : "0",
      currency: "BRL",
      sourceSystem: "integration",
      sourceReference: `receipt:${input.receiptId}:receivable`,
      normalizationVersion: "1.0",
      normalizationWorkerId: this.workerId,
      parties: isBaixado
        ? buildCashInParties(
            input.operatorId,
            this.usinaPartyId,
            input.downloadedValue,
          )
        : buildNonCashParties(input.operatorId, this.usinaPartyId),
      objects: buildObjects(
        input.receiptId,
        input.proposalId,
        input.installmentNumber,
        isBaixado,
      ),
      reason: {
        type: isBaixado
          ? ReasonType.COMMISSION_PAYMENT
          : ReasonType.LATE_IDENTIFIED_COMMISSION,
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
    {
      partyId: usinaPartyId,
      role: PartyRole.PAYEE,
      direction: Direction.IN,
      amount: downloadedValue,
    },
  ];
}

function buildNonCashParties(
  operatorId: string,
  usinaPartyId: string,
): StagingRecord["parties"] {
  return [
    {
      partyId: operatorId,
      role: PartyRole.PAYER,
      direction: Direction.NEUTRAL,
    },
    {
      partyId: usinaPartyId,
      role: PartyRole.PAYEE,
      direction: Direction.NEUTRAL,
    },
  ];
}

function buildObjects(
  receiptId: string,
  proposalId: string,
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
      objectId: proposalId,
      objectType: ObjectType.PROPOSAL,
      relation: Relation.REFERENCES,
    },
    {
      objectId: `${proposalId}:${installmentNumber}`,
      objectType: ObjectType.INSTALLMENT,
      relation: Relation.REFERENCES,
    },
  ];
}
