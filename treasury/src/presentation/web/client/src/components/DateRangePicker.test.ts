// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { fitOnScreen } from "@/components/DateRangePicker";

const trigger = (left: number, width = 200) =>
  ({ getBoundingClientRect: () => ({ left, width, right: left + width }) }) as unknown as HTMLElement;

describe("fitOnScreen — o calendário nunca fica cortado", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  });

  it("com espaço, abre alinhado à esquerda do botão", () => {
    expect(fitOnScreen(trigger(100), "left")).toBe(0);
  });

  it("perto da borda direita, desliza para dentro da janela", () => {
    const offset = fitOnScreen(trigger(1000), "left")!;
    expect(1000 + offset + 680).toBeLessThanOrEqual(1280 - 8);
  });

  it("alinhado à direita perto da borda esquerda, também desliza para dentro", () => {
    const offset = fitOnScreen(trigger(20), "right")!;
    expect(20 + offset).toBeGreaterThanOrEqual(8);
  });

  it("em tela estreita, ocupa a largura disponível sem sair por nenhum lado", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    const offset = fitOnScreen(trigger(200, 150), "left")!;
    expect(200 + offset).toBeGreaterThanOrEqual(8);
    expect(200 + offset + 375 * 0.95).toBeLessThanOrEqual(375 - 8 + 0.01);
  });
});
