export interface PageOptions {
  /** 1-based page number. Defaults to 1. */
  page: number;
  /** Maximum items per page. Defaults to 50, capped at 200. */
  limit: number;
  sortBy?: 'occurredAt' | 'recordedAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DEFAULT_PAGE_OPTIONS: PageOptions = { page: 1, limit: 50 };
export const MAX_PAGE_LIMIT = 200;

export function normalizePageOptions(raw: Partial<PageOptions>): PageOptions {
  const page = Math.max(1, Number.isInteger(raw.page) ? (raw.page as number) : 1);
  const rawLimit = Number.isInteger(raw.limit) ? (raw.limit as number) : DEFAULT_PAGE_OPTIONS.limit;
  const limit = Math.min(Math.max(1, rawLimit), MAX_PAGE_LIMIT);
  const sortBy = raw.sortBy;
  const sortOrder = raw.sortOrder;
  return { page, limit, ...(sortBy && { sortBy }), ...(sortOrder && { sortOrder }) };
}

export function paginate<T>(items: T[], options: PageOptions): Page<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / options.limit) || 1;
  const offset = (options.page - 1) * options.limit;
  const data = items.slice(offset, offset + options.limit);
  return { data, total, page: options.page, limit: options.limit, totalPages };
}
