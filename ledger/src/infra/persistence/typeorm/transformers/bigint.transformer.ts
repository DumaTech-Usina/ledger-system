import { ValueTransformer } from 'typeorm';

/**
 * Converts between JS bigint and the string representation that the
 * pg driver returns for PostgreSQL BIGINT columns.
 *
 * Required because PostgreSQL BIGINT exceeds JavaScript's safe integer
 * range — the pg driver always returns them as strings to preserve precision.
 * Money.units is stored as bigint, so this bridge is mandatory.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: bigint | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    return value.toString();
  },
  from: (value: string | null | undefined): bigint | null => {
    if (value === null || value === undefined) return null;
    return BigInt(value);
  },
};
