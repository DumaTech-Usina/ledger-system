import { describe, it, expect } from "vitest";
import { resolveOperationsStore } from "../../config/operationsStore";

describe("onde ficam intenções e auditoria", () => {
  it("com o Ledger real, é SQLite sem precisar configurar", () => {
    expect(resolveOperationsStore("live")).toBe("sqlite");
    expect(resolveOperationsStore("live", "sqlite")).toBe("sqlite");
  });

  it("com o Ledger real, memória é recusada (REQ-801)", () => {
    expect(() => resolveOperationsStore("live", "memory")).toThrow(/REQ-801|restart/);
  });

  it.each(["simulate", "stub"])("em %s, é memória, a menos que se peça SQLite", (mode) => {
    expect(resolveOperationsStore(mode)).toBe("memory");
    expect(resolveOperationsStore(mode, "sqlite")).toBe("sqlite");
  });
});
