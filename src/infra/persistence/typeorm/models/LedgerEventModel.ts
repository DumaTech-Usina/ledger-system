import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { LedgerEventObjectModel } from './LedgerEventObjectModel';
import { LedgerEventPartyModel } from './LedgerEventPartyModel';

/**
 * Persistence model for a ledger event.
 *
 * Reporter and reason are stored as flat columns (no extra join) because
 * they are always 1-to-1 with the event.
 *
 * Parties and objects are stored as child tables because they are 1-to-many.
 */
@Entity('ledger_events')
export class LedgerEventModel {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType!: string;

  @Column({ name: 'economic_effect', type: 'varchar' })
  economicEffect!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ name: 'source_at', type: 'timestamptz', nullable: true })
  sourceAt!: Date | null;

  /** Money.units stored as bigint — see bigintTransformer for the pg ↔ JS bridge */
  @Column({
    name: 'amount_units',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  amountUnits!: bigint;

  @Column({ name: 'amount_currency', type: 'varchar', length: 3 })
  amountCurrency!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ name: 'source_system', type: 'varchar' })
  sourceSystem!: string;

  @Column({ name: 'source_reference', type: 'varchar' })
  sourceReference!: string;

  @Column({ name: 'normalization_version', type: 'varchar' })
  normalizationVersion!: string;

  @Column({ name: 'normalization_worker_id', type: 'varchar' })
  normalizationWorkerId!: string;

  @Column({ type: 'varchar', unique: true })
  hash!: string;

  @Column({ name: 'previous_hash', type: 'varchar', nullable: true })
  previousHash!: string | null;

  // ── Reporter (embedded columns) ────────────────────────────────────────────

  @Column({ name: 'reporter_type', type: 'varchar' })
  reporterType!: string;

  @Column({ name: 'reporter_id', type: 'varchar' })
  reporterId!: string;

  @Column({ name: 'reporter_name', type: 'varchar', nullable: true })
  reporterName!: string | null;

  @Column({ name: 'reported_at', type: 'timestamptz' })
  reportedAt!: Date;

  @Column({ name: 'reporter_channel', type: 'varchar' })
  reporterChannel!: string;

  // ── Reason (embedded columns, fully nullable) ──────────────────────────────

  @Column({ name: 'reason_type', type: 'varchar', nullable: true })
  reasonType!: string | null;

  @Column({ name: 'reason_description', type: 'varchar', nullable: true })
  reasonDescription!: string | null;

  @Column({ name: 'reason_confidence', type: 'varchar', nullable: true })
  reasonConfidence!: string | null;

  @Column({
    name: 'reason_requires_followup',
    type: 'boolean',
    nullable: true,
  })
  reasonRequiresFollowup!: boolean | null;

  // ── Relations ──────────────────────────────────────────────────────────────

  @OneToMany(() => LedgerEventPartyModel, (party) => party.event, {
    cascade: true,
    eager: true,
  })
  parties!: LedgerEventPartyModel[];

  @OneToMany(() => LedgerEventObjectModel, (obj) => obj.event, {
    cascade: true,
    eager: true,
  })
  objects!: LedgerEventObjectModel[];
}
