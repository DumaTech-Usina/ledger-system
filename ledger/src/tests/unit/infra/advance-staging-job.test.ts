import { describe, it, expect, vi } from 'vitest'
import { AdvanceStagingJob } from '../../../infra/jobs/AdvanceStagingJob'
import { EnrichedAdvanceInput } from '../../../core/application/dtos/EnrichedAdvanceInput'
import { InMemoryStagingRepository } from '../../../infra/persistence/staging/InMemoryStagingRepository'
import { EconomicEffect } from '../../../core/domain/enums/EconomicEffect'
import { EventType } from '../../../core/domain/enums/EventType'
import { Direction } from '../../../core/domain/enums/Direction'
import { ObjectType } from '../../../core/domain/enums/ObjectType'
import { Relation } from '../../../core/domain/enums/Relation'

const USINA_ID = 'usina-001'
const WORKER_ID = 'advance-worker-v1'

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

function buildJob(repo?: InMemoryStagingRepository, warn?: (msg: string) => void) {
  const stagingRepo = repo ?? new InMemoryStagingRepository([])
  return { job: new AdvanceStagingJob(stagingRepo, USINA_ID, WORKER_ID, warn), stagingRepo }
}

describe('AdvanceStagingJob — translating advance reports into ledger staging records', () => {

  describe('eligible advances — paid, not cancelled, positive amount, broker present', () => {

    it('saves a staging record for a valid advance', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput())
      expect(await stagingRepo.findAll()).toHaveLength(1)
    })

    it('sets eventType to ADVANCE_PAYMENT', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput())
      const [record] = await stagingRepo.findAll()
      expect(record.eventType).toBe(EventType.ADVANCE_PAYMENT)
    })

    it('sets economicEffect to CASH_OUT', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput())
      const [record] = await stagingRepo.findAll()
      expect(record.economicEffect).toBe(EconomicEffect.CASH_OUT)
    })

    it('builds a deterministic sourceReference encoding the advance report id', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ advanceReportId: 'adv-xyz' }))
      const [record] = await stagingRepo.findAll()
      expect(record.sourceReference).toBe('advance:adv-xyz:disbursement')
    })

    it('sets status to pending', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput())
      const [record] = await stagingRepo.findAll()
      expect(record.status).toBe('pending')
    })

    it('serializes amount as a positive string with two decimal places', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ amountToPay: 150.75 }))
      const [record] = await stagingRepo.findAll()
      expect(record.amount).toBe('150.75')
      expect(typeof record.amount).toBe('string')
    })

    it('timestamps the record to the advance createdAt date', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ createdAt: new Date('2025-03-05T00:00:00Z') }))
      const [record] = await stagingRepo.findAll()
      expect(record.occurredAt).toBe('2025-03-05T00:00:00.000Z')
    })

    it('Usina is the payer with Direction.OUT; broker is the payee with Direction.NEUTRAL', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ brokerId: 'broker-specific' }))
      const [record] = await stagingRepo.findAll()
      const payer = record.parties!.find(p => p.direction === Direction.OUT)
      const payee = record.parties!.find(p => p.direction === Direction.NEUTRAL)
      expect(payer?.partyId).toBe(USINA_ID)
      expect(payee?.partyId).toBe('broker-specific')
    })

    it('payer amount matches the advance amountToPay', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ amountToPay: 200.00 }))
      const [record] = await stagingRepo.findAll()
      const payer = record.parties!.find(p => p.direction === Direction.OUT)
      expect(payer?.amount).toBe('200.00')
    })

    it('registers the advance object with ORIGINATES relation', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ advanceReportId: 'adv-obj-1' }))
      const [record] = await stagingRepo.findAll()
      const obj = record.objects!.find(o => o.objectType === ObjectType.ADVANCE)
      expect(obj?.relation).toBe(Relation.ORIGINATES)
      expect(obj?.objectId).toBe('adv-obj-1')
    })

    it('running twice with the same input produces two separate staging records', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput())
      await job.run(validInput())
      const all = await stagingRepo.findAll()
      expect(all).toHaveLength(2)
      expect(all[0].sourceReference).toBe(all[1].sourceReference)
    })

  })

  describe('ineligible advances — must not reach the staging pipeline', () => {

    it('does not save when isPaid is false', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ isPaid: false }))
      expect(await stagingRepo.findAll()).toHaveLength(0)
    })

    it('does not save when isCancelled is true', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ isCancelled: true }))
      expect(await stagingRepo.findAll()).toHaveLength(0)
    })

    it('does not save when amountToPay is zero', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ amountToPay: 0 }))
      expect(await stagingRepo.findAll()).toHaveLength(0)
    })

    it('does not save when amountToPay is negative', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ amountToPay: -100 }))
      expect(await stagingRepo.findAll()).toHaveLength(0)
    })

    it('does not save when brokerId is empty', async () => {
      const { job, stagingRepo } = buildJob()
      await job.run(validInput({ brokerId: '' }))
      expect(await stagingRepo.findAll()).toHaveLength(0)
    })

  })

  describe('observability — ineligible advances emit a warn trace', () => {

    it('warn is called with the advance id when isPaid is false', async () => {
      const warn = vi.fn()
      const { job } = buildJob(undefined, warn)
      await job.run(validInput({ advanceReportId: 'adv-not-paid', isPaid: false }))
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0][0]).toContain('adv-not-paid')
    })

    it('warn is called when amountToPay is zero', async () => {
      const warn = vi.fn()
      const { job } = buildJob(undefined, warn)
      await job.run(validInput({ advanceReportId: 'adv-zero', amountToPay: 0 }))
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0][0]).toContain('adv-zero')
    })

    it('warn is not called for an eligible advance', async () => {
      const warn = vi.fn()
      const { job } = buildJob(undefined, warn)
      await job.run(validInput())
      expect(warn).not.toHaveBeenCalled()
    })

  })

})
