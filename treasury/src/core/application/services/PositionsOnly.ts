import type { PositionsPage } from "../dtos/LedgerReadModels";
import type { LedgerReadPort, PositionsQuery } from "../ports/LedgerReadPort";

/**
 * DEC-035 (decided 2026-11-09, option 2): the Ledger lists contextual objects beside positions — a
 * policy shows as "open" with a balance of 0,00 — and a reader takes that as something outstanding.
 * Treasury's position listings ask only for the kinds that hold a balance.
 *
 * The restriction travels in the request, not as a filter over the answer, so the page, the limit and
 * the total remain the Ledger's own. Every other read passes through untouched.
 */
export function positionsOnly<T extends LedgerReadPort>(ledger: T, positionalTypes: readonly string[]): T {
  const allowed = new Set(positionalTypes);

  const positions = async (params: PositionsQuery = {}): Promise<PositionsPage> => {
    const requested = params.objectType === undefined ? [] : [params.objectType].flat().filter((t) => t !== "");
    const objectType = requested.length === 0 ? [...allowed] : requested.filter((t) => allowed.has(t));
    if (objectType.length === 0) {
      // Only contexts were asked for: there are no positions of that kind, by definition.
      const limit = params.limit ?? 20;
      return { data: [], total: 0, page: params.page ?? 1, limit, totalPages: 0 };
    }
    return ledger.positions({ ...params, objectType });
  };

  return new Proxy(ledger, {
    get(target, prop, receiver) {
      if (prop === "positions") return positions;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
