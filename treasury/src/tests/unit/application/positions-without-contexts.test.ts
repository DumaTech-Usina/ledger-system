import { describe, it, expect } from "vitest";
import { positionsOnly } from "../../../core/application/services/PositionsOnly";
import type { LedgerReadPort, PositionsQuery } from "../../../core/application/ports/LedgerReadPort";
import { algebra } from "../../fixtures/algebra";

/**
 * DEC-035 (2026-11-09, option 2): the Ledger lists contextual objects — a policy, a proposal — beside
 * positions, with status "open" and balance 0,00. Treasury's position listings ask only for the kinds
 * that hold a balance, so a policy never reads as something open. The Ledger is unchanged, and the
 * page and total still come from it.
 */
function recording() {
  const asked: PositionsQuery[] = [];
  const port = {
    positions: async (params?: PositionsQuery) => {
      asked.push(params ?? {});
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    },
  } as unknown as LedgerReadPort;
  return { asked, port: positionsOnly(port, algebra().positionalObjectTypes()) };
}

describe("DEC-035 — contextos fora da lista de posições", () => {
  it("sem filtro de tipo, pede só os tipos que têm saldo", async () => {
    const { asked, port } = recording();
    await port.positions({ page: 2 });

    const types = [asked[0].objectType ?? []].flat();
    expect(asked[0].page).toBe(2);
    expect(types).toContain("advance");
    expect(types).toContain("commission_payable");
    for (const context of ["contract", "proposal", "installment", "settlement_batch", "campaign"]) {
      expect(types).not.toContain(context);
    }
  });

  it("com filtro, tira os contextos e mantém o resto", async () => {
    const { asked, port } = recording();
    await port.positions({ objectType: ["advance", "contract"] });

    expect(asked[0].objectType).toEqual(["advance"]);
  });

  it("pedindo só contextos, a resposta é uma lista vazia, sem consultar o Ledger", async () => {
    const { asked, port } = recording();
    const page = await port.positions({ objectType: "contract", limit: 20 });

    expect(asked).toHaveLength(0);
    expect(page).toEqual({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  });

  it("as outras leituras passam direto", async () => {
    const cash = { balance: "10.00" };
    const port = positionsOnly({ cashPosition: async () => cash } as unknown as LedgerReadPort, ["advance"]);
    expect(await port.cashPosition()).toBe(cash);
  });
});
