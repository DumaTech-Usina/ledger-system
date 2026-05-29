/**
 * OPERATIONAL EVENT CARD
 * ─────────────────────────────────────────────────────────────
 * Operational event:   Usina disburses an advance on future commission to a broker
 * Archetype:           Posting Job
 * Primary entity:      AdvanceReport
 * Natural key:         advance_report_id
 * Validation needed:   YES (reads aspirant_advance_canonical)
 * ─────────────────────────────────────────────────────────────
 *
 * TRANSLATION JOB CARD
 * ─────────────────────────────────────────────────────────────
 * Archetype:               Posting Job
 * Economic effect:         CASH_OUT
 * EventType:               ADVANCE_PAYMENT
 * ObjectType:              ADVANCE (positional)
 * Relation:                ORIGINATES
 * ReasonType:              ADVANCE_PAYMENT
 *
 * Five-matrix gate (all must pass before coding):
 *   [✓] Effect × Relation    ECONOMIC_EFFECT_RELATION_MATRIX  — CASH_OUT allows ORIGINATES
 *   [✓] Object × Nature      OBJECT_NATURE_MATRIX             — ADVANCE is POSITIONAL
 *   [✓] Object × Relation    OBJECT_RELATION_MATRIX           — ADVANCE allows ORIGINATES
 *   [✓] Reason × Effect      REASON_EFFECT_MATRIX             — ADVANCE_PAYMENT allows CASH_OUT
 *   [✓] Reason × Relation    REASON_RELATION_MATRIX           — ADVANCE_PAYMENT allows ORIGINATES
 *
 * Party directions:         OUT: usinaPartyId (PAYER)  NEUTRAL: brokerId (PAYEE)
 * sourceReference pattern:  advance:<advanceReportId>:disbursement
 * Reads canonical from:     aspirant_advance_canonical via MongoAdvanceReportReader (server-side CLEAN filter)
 * ─────────────────────────────────────────────────────────────
 */

import type { StagingRepository } from '../../core/application/repositories/StagingRepository'
import type { StagingRecord } from '../../core/application/dtos/StagingRecord'
import type { EnrichedAdvanceInput } from '../../core/application/dtos/EnrichedAdvanceInput'
import { ConfidenceLevel } from '../../core/domain/enums/ConfidenceLevel'
import { Direction } from '../../core/domain/enums/Direction'
import { EconomicEffect } from '../../core/domain/enums/EconomicEffect'
import { EventType } from '../../core/domain/enums/EventType'
import { ObjectType } from '../../core/domain/enums/ObjectType'
import { PartyRole } from '../../core/domain/enums/PartyRole'
import { ReasonType } from '../../core/domain/enums/ReasonType'
import { Relation } from '../../core/domain/enums/Relation'
import { ReporterType } from '../../core/domain/enums/ReporterType'

export class AdvanceStagingJob {
  constructor(
    private readonly stagingRepo: StagingRepository,
    private readonly usinaPartyId: string,
    private readonly workerId: string,
    private readonly warn: (message: string) => void = () => {},
  ) {}

  async run(input: EnrichedAdvanceInput): Promise<void> {
    if (!this.isEligible(input)) return
    await this.stagingRepo.save(this.buildCandidate(input))
  }

  private isEligible(input: EnrichedAdvanceInput): boolean {
    if (!input.isPaid) {
      this.warn(`Skipped advance ${input.advanceReportId}: not paid`)
      return false
    }
    if (input.isCancelled) {
      this.warn(`Skipped advance ${input.advanceReportId}: cancelled`)
      return false
    }
    if (input.amountToPay <= 0) {
      this.warn(`Skipped advance ${input.advanceReportId}: amountToPay=${input.amountToPay} is not positive`)
      return false
    }
    if (!input.brokerId) {
      this.warn(`Skipped advance ${input.advanceReportId}: brokerId is empty`)
      return false
    }
    return true
  }

  private buildCandidate(input: EnrichedAdvanceInput): StagingRecord {
    const amountStr = input.amountToPay.toFixed(2)
    return {
      id: crypto.randomUUID(),
      status: 'pending',
      eventType: EventType.ADVANCE_PAYMENT,
      economicEffect: EconomicEffect.CASH_OUT,
      occurredAt: input.createdAt.toISOString(),
      amount: amountStr,
      currency: 'BRL',
      sourceSystem: 'integration',
      sourceReference: `advance:${input.advanceReportId}:disbursement`,
      normalizationVersion: '1.0',
      normalizationWorkerId: this.workerId,
      parties: [
        { partyId: this.usinaPartyId, role: PartyRole.PAYER, direction: Direction.OUT, amount: amountStr },
        { partyId: input.brokerId, role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
      ],
      objects: [
        { objectId: input.advanceReportId, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES },
      ],
      reason: {
        type: ReasonType.ADVANCE_PAYMENT,
        description: 'Advance on future commission',
        confidence: ConfidenceLevel.HIGH,
        requiresFollowup: false,
      },
      reporter: {
        reporterType: ReporterType.SYSTEM,
        reporterId: 'advance-posting-job',
        channel: 'batch-integration',
      },
    }
  }
}
