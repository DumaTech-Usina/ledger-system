import { ValueTransformer } from 'typeorm';

/**
 * Converts between JS bigint and what the driver stores for a 64-bit integer column.
 *
 * Money.units is a bigint, and it must survive the round trip exactly — a cent lost to a floating
 * point conversion is a cent the book cannot account for.
 *
 * SQLite columns have INTEGER affinity, so a numeric string written here is stored as a true
 * integer, and better-sqlite3 hands it back as a JS `number`. Values up to 2^53 cents (about
 * 90 trillion in any currency) are exact in that form; the raw aggregate queries, where a SUM can
 * in principle grow past it, cast to TEXT in SQL instead and never rely on this path.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: bigint | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    return value.toString();
  },
  from: (value: string | number | null | undefined): bigint | null => {
    if (value === null || value === undefined) return null;
    return BigInt(value);
  },
};
