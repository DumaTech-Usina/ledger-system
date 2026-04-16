import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerEventModel } from './LedgerEventModel';

@Entity('ledger_event_objects')
export class LedgerEventObjectModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'event_id', type: 'varchar' })
  eventId!: string;

  @ManyToOne(() => LedgerEventModel, (event) => event.objects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event!: LedgerEventModel;

  @Column({ name: 'object_id', type: 'varchar' })
  objectId!: string;

  @Column({ name: 'object_type', type: 'varchar' })
  objectType!: string;

  @Column({ type: 'varchar' })
  relation!: string;
}
