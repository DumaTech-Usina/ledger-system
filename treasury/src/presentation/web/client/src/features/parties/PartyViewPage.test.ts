// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n/i18n";

const names = vi.fn();
const events = vi.fn();

vi.mock("@/features/parties/partiesApi", () => ({
  partiesApi: { names: () => names(), events: (id: string) => events(id) },
}));

const { PartyViewPage } = await import("@/features/parties/PartyViewPage");

const party = { partyId: "joao", displayName: "João Silva" };
const baseEvent = {
  eventType: "advance_payment",
  economicEffect: "cash_out",
  currency: "BRL",
  occurredAt: "2026-08-01T12:00:00.000Z",
  recordedAt: "2026-08-01T12:00:00.000Z",
  description: null,
  parties: [
    { partyId: "joao", role: "payee", direction: "in", amount: null },
    { partyId: "argo", role: "payer", direction: "out", amount: null },
  ],
  roles: [{ role: "payee", direction: "in", recordedAs: "joao" }],
};

const open = async () => {
  render(createElement(LanguageProvider, null, createElement(PartyViewPage)));
  fireEvent.click(await screen.findByRole("button", { name: "João Silva" }));
};

beforeEach(() => {
  localStorage.setItem("treasury.language", "pt-BR");
  names.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      parties: [
        { ...party, state: "identified" },
        { partyId: "prov", displayName: "Maria", state: "provisional" },
      ],
    },
  });
  events.mockReset();
});

afterEach(cleanup);

describe("a visão por parte", () => {
  it("mostra o evento, o papel e quem mais está nele, pelo nome", async () => {
    events.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        available: true,
        party,
        identifiers: ["joao"],
        events: [{ ...baseEvent, eventId: "e1", amount: "100.00", retracted: false }],
        partyNames: { argo: "Argo Ltda" },
      },
    });

    await open();

    expect(await screen.findByText("Argo Ltda")).toBeTruthy();
    expect(events).toHaveBeenCalledWith("joao");
  });

  it("marca a identidade provisória na lista", async () => {
    render(createElement(LanguageProvider, null, createElement(PartyViewPage)));

    expect(await screen.findByRole("button", { name: "Maria (provisória)" })).toBeTruthy();
  });

  it("REQ-524: um lançamento retirado aparece, marcado como retirado", async () => {
    events.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        available: true,
        party,
        identifiers: ["joao"],
        events: [{ ...baseEvent, eventId: "e1", amount: "400.00", retracted: true }],
        partyNames: {},
      },
    });

    await open();

    expect(await screen.findByText("Retirado")).toBeTruthy();
  });

  it("REQ-332: diz sob quais outros identificadores a parte foi registrada", async () => {
    events.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, party, identifiers: ["joao", "J. SILVA"], events: [], partyNames: {} },
    });

    await open();

    expect((await screen.findByText(/Registrado também como/)).textContent).toContain("J. SILVA");
  });

  it("nenhum evento é uma resposta, e diz isso", async () => {
    events.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, party, identifiers: ["joao"], events: [], partyNames: {} },
    });

    await open();

    expect(await screen.findByText("Nenhum evento registrado para esta parte.")).toBeTruthy();
  });

  it("REQ-602: Ledger fora do ar não se confunde com nenhum evento", async () => {
    events.mockResolvedValue({ ok: true, status: 200, data: { available: false, party } });

    await open();

    expect(await screen.findByText(/Não foi possível ler o Ledger/)).toBeTruthy();
    expect(screen.queryByText("Nenhum evento registrado para esta parte.")).toBeNull();
  });

  it("um erro do servidor também aparece como indisponível, e não como uma tela em branco", async () => {
    events.mockResolvedValue({ ok: false, status: 500, data: { error: "boom" } });

    await open();

    expect(await screen.findByText(/Não foi possível ler o Ledger/)).toBeTruthy();
  });

  it("uma falha de rede também aparece como indisponível", async () => {
    events.mockRejectedValue(new Error("offline"));

    await open();

    expect(await screen.findByText(/Não foi possível ler o Ledger/)).toBeTruthy();
  });
});
