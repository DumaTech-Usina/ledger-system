// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Composer } from "@/features/operations/Composer";

afterEach(cleanup);

function renderMoney() {
  const onSend = vi.fn();
  render(createElement(Composer, { onSend, busy: false, required: true, moneySlot: true, placeholder: "Qual é o valor?" }));
  return { onSend, input: screen.getByRole("textbox") as HTMLInputElement };
}

describe("o campo de valor do chat", () => {
  it("CA-224: mostra R$ 20,00 ao digitar 2000, e envia 20.00", () => {
    const { onSend, input } = renderMoney();

    fireEvent.change(input, { target: { value: "2000" } });
    expect(input.value).toBe("R$ 20,00");

    fireEvent.click(screen.getByRole("button"));
    expect(onSend).toHaveBeenCalledWith("20.00");
  });

  it("não envia um campo vazio numa pergunta obrigatória", () => {
    const { onSend } = renderMoney();

    fireEvent.click(screen.getByRole("button"));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("só aceita dígitos", () => {
    const { input } = renderMoney();

    fireEvent.change(input, { target: { value: "12a3" } });

    expect(input.value).toBe("R$ 1,23");
  });

  it("uma pergunta que não é de valor continua aceitando texto livre", () => {
    const onSend = vi.fn();
    render(createElement(Composer, { onSend, busy: false, placeholder: "Quem recebe?" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Maria 2000" } });
    fireEvent.click(screen.getByRole("button"));

    expect(onSend).toHaveBeenCalledWith("Maria 2000");
  });
});
