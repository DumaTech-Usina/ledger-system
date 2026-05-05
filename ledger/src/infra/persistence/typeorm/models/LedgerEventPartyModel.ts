import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { LedgerEventModel } from './LedgerEventModel';

@Entity('ledger_event_parties')
export class LedgerEventPartyModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'event_id', type: 'varchar' })
  eventId!: string;

  @ManyToOne(() => LedgerEventModel, (event) => event.parties, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event!: LedgerEventModel;

  @Column({ name: 'party_id', type: 'varchar' })
  partyId!: string;

  @Column({ type: 'varchar' })
  role!: string;

  @Column({ type: 'varchar' })
  direction!: string;

  /** Null for NEUTRAL direction parties (no monetary flow) */
  @Column({
    name: 'amount_units',
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  amountUnits!: bigint | null;

  @Column({ name: 'amount_currency', type: 'varchar', length: 3, nullable: true })
  amountCurrency!: string | null;
}
