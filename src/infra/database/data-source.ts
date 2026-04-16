import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../../config/env';
import { LedgerEventObjectModel } from '../persistence/typeorm/models/LedgerEventObjectModel';
import { LedgerEventModel } from '../persistence/typeorm/models/LedgerEventModel';
import { LedgerEventPartyModel } from '../persistence/typeorm/models/LedgerEventPartyModel';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,

  /**
   * SSL: when DB_SSL=true, disable certificate validation so self-signed
   * certs (common in managed cloud DBs) are accepted without extra setup.
   * Set rejectUnauthorized=true and provide a CA cert for strict enforcement.
   */
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,

  /** Always false — schema changes go through migrations only */
  synchronize: false,

  logging: env.DB_LOGGING,

  entities: [
    LedgerEventModel,
    LedgerEventPartyModel,
    LedgerEventObjectModel,
  ],

  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsRun: env.DB_MIGRATIONS_RUN,
});
