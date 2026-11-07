import { describe, it, expect } from "vitest";
import { resolveStore } from "../../config/operationsStore";

describe("onde fica o que precisa sobreviver a um reinício", () => {
  it("com o Ledger real, é SQLite sem precisar configurar", () => {
    expect(resolveStore("live", "X")).toBe("sqlite");
    expect(resolveStore("live", "X", "sqlite")).toBe("sqlite");
  });

  it("com o Ledger real, memória é recusada, e o erro diz qual variável corrigir", () => {
    expect(() => resolveStore("live", "PARTY_DIRECTORY_MODE", "memory")).toThrow(/PARTY_DIRECTORY_MODE=memory/);
  });

  it.each(["simulate", "stub"])("em %s, é memória, a menos que se peça SQLite", (mode) => {
    expect(resolveStore(mode, "X")).toBe("memory");
    expect(resolveStore(mode, "X", "sqlite")).toBe("sqlite");
  });
});
