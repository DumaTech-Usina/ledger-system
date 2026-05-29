import { describe, it, expect } from 'vitest'
import { AdvanceStagingJob } from '../../../infra/jobs/AdvanceStagingJob'
import { EnrichedAdvanceInput } from '../../../core/application/dtos/EnrichedAdvanceInput'
import { StagingPostingJob } from '../../../infra/jobs/StagingPostingJob'
import { InMemoryLedgerEventRepository } from '../../../infra/persistence/memory/InMemoryLedgerEventRepository'
import { InMemoryRejectedEventRepository } from '../../../infra/persistence/rejected/InMemoryRejectedEventRepository'
import { InMemoryStagingRepository } from '../../../infra/persistence/staging/InMemoryStagingRepository'
import { CreateLedgerEventUseCase } from '../../../core/application/use-cases/CreateLedgerEventUseCase'
import { RejectLedgerEventUseCase } from '../../../core/application/use-cases/RejectLedgerEventUseCase'
import { StagingRecordValidator } from '../../../core/application/services/StagingRecordValidator'
import { NoOpAuditLogger } from '../../../infra/audit/NoOpAuditLogger'
import { EconomicEffect } from '../../../core/domain/enums/EconomicEffect'
import { EventType } from '../../../core/domain/enums/EventType'
import { StagingRecord } from '../../../core/application/dtos/StagingRecord'

function buildPipeline() {
  const stagingRepo = new InMemoryStagingRepository([])
  const ledgerRepo = new InMemoryLedgerEventRepository()
  const rejectedRepo = new InMemoryRejectedEventRepository()
  const audit = new NoOpAuditLogger()
  const validator = new StagingRecordValidator(ledgerRepo)
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, audit)
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, audit)
  const processJob = new StagingPostingJob(stagingRepo, validator, createUseCase, rejectUseCase)
  const postingJob = new AdvanceStagingJob(stagingRepo, 'usina-party-id', 'advance-worker-v1')
  return { stagingRepo, ledgerRepo, rejectedRepo, processJob, postingJob }
}

function validInput(overrides: Partial<EnrichedAdvanceInput> = {}): EnrichedAdvanceInput {
  return {
    advanceReportId: 'adv-report-1',
    amountToPay: 500.00,
    brokerId: 'broker-abc',
    isPaid: true,
    isCancelled: false,
    createdAt: new Date('2025-03-05T00:00:00Z'),
    ...overrides,
  }
}

describe('Advance posting flow — AdvanceStagingJob → StagingPostingJob → LedgerEvent', () => {

  it('a valid advance produces one LedgerEvent with ADVANCE_PAYMENT and CASH_OUT', async () => {
    const { postingJob, processJob, ledgerRepo } = buildPipeline()

    await postingJob.run(validInput())
    await processJob.run()

    const events = await ledgerRepo.findAll()
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe(EventType.ADVANCE_PAYMENT)
    expect(events[0].economicEffect).toBe(EconomicEffect.CASH_OUT)
    expect(Number(events[0].amount.toString())).toBeGreaterThan(0)
  })

  it('does not produce a LedgerEvent when input is ineligible', async () => {
    const { postingJob, processJob, ledgerRepo, rejectedRepo } = buildPipeline()

    await postingJob.run(validInput({ amountToPay: 0 }))
    await processJob.run()

    expect(await ledgerRepo.findAll()).toHaveLength(0)
    expect(await rejectedRepo.findAll()).toHaveLength(0)
  })

  it('rejects a malformed staging record that bypasses isEligible', async () => {
    const { stagingRepo, processJob, ledgerRepo, rejectedRepo } = buildPipeline()

    const malformed: StagingRecord = {
      id: 'stg-corrupt',
      status: 'pending',
      eventType: EventType.ADVANCE_PAYMENT,
      economicEffect: EconomicEffect.CASH_OUT,
      occurredAt: new Date('2025-03-05').toISOString(),
      amount: '-999',
      currency: 'BRL',
      sourceSystem: 'integration',
      sourceReference: 'advance:corrupt-1:disbursement',
      normalizationVersion: '1.0',
      normalizationWorkerId: 'worker-1',
      parties: [{ partyId: 'usina-party-id', role: 'payer', direction: 'out', amount: '-999' }],
      objects: [{ objectId: 'corrupt-1', objectType: 'advance', relation: 'originates' }],
      reason: { type: 'advance_payment', description: 'test', confidence: 'high', requiresFollowup: false },
      reporter: { reporterType: 'system', reporterId: 'advance-posting-job', channel: 'batch-integration' },
    }
    await stagingRepo.save(malformed)
    await processJob.run()

    expect(await ledgerRepo.findAll()).toHaveLength(0)
    expect(await rejectedRepo.findAll()).toHaveLength(1)
  })

  it('duplicate sourceReference on second run — first accepted, second rejected', async () => {
    const { postingJob, processJob, ledgerRepo, rejectedRepo } = buildPipeline()

    await postingJob.run(validInput({ advanceReportId: 'adv-dup' }))
    await processJob.run()

    await postingJob.run(validInput({ advanceReportId: 'adv-dup' }))
    await processJob.run()

    expect(await ledgerRepo.findAll()).toHaveLength(1)
    expect(await rejectedRepo.findAll()).toHaveLength(1)
  })

})
