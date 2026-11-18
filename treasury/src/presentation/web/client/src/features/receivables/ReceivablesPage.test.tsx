// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n/i18n";

/**
 * §8.11 on the receivables agenda: the credit of the payer chosen in the filter (REQ-695), and an
 * advance that leads to its party's page to be compensated (REQ-696). Written against what the
 * operator sees.
 */

const get = vi.fn();
const insurerReceivables = vi.fn();

vi.mock("@/features/receivables/receivablesApi", () => ({
  receivablesApi: {
    get: (...args: unknown[]) => get(...args),
    declared: vi.fn(async () => ({ ok: true, status: 200, data: { available: true, lines: [] } })),
  },
}));
vi.mock("@/features/signals/signalsApi", () => ({
  signalsApi: { receivables: (payer: string) => insurerReceivables(payer) },
}));

const { ReceivablesPage } = await import("@/features/receivables/ReceivablesPage");

const allianz = { partyId: "allianz", displayName: "Allianz" };
const joao = { partyId: "joao", displayName: "João" };
const summary = (count: number) => ({ count, totals: count ? { BRL: "100.00" } : {} });
const line = (objectId: string, objectType: string, payers: { partyId: string; displayName: string }[]) => ({
  objectId,
  objectType,
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "500.00",
  openBalance: "500.00",
  eventCount: 1,
  lastEventAt: null,
  createdAt: null,
  dueAt: null,
  payers,
  openForDays: 10,
  partiallyReceived: false,
  policyId: null,
  declared: null,
});

/** The agenda opens on "sem data", with an advance from João and an expected commission from Allianz. */
const agenda = (payer: string | null) => ({
  ok: true,
  status: 200,
  data: {
    available: true,
    asOf: "2026-11-18",
    windowDays: 7,
    windows: { overdue: summary(0), today: summary(0), next: summary(0), later: summary(0), undated: summary(2) },
    unlinked: summary(0),
    payers: [
      { key: "allianz", payers: [allianz], ...summary(1) },
      { key: "joao", payers: [joao], ...summary(1) },
    ],
    payer,
    window: "undated",
    lines:
      payer === "allianz"
        ? [line("cr-1", "commission_receivable", [allianz])]
        : payer === "joao"
          ? [line("adv-1", "advance", [joao])]
          : [line("adv-1", "advance", [joao]), line("cr-1", "commission_receivable", [allianz])],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
});

const choosePayer = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole("button", { name: /Pagador/ }));
  fireEvent.click(await screen.findByRole("option", { name }));
};

beforeEach(() => {
  localStorage.setItem("treasury.language", "pt-BR");
  get.mockReset().mockImplementation(async (q: { payer?: string | null }) => agenda(q.payer ?? null));
  insurerReceivables.mockReset().mockImplementation(async (payer: string) => ({
    ok: true,
    status: 200,
    data: { receivables: payer === "allianz" ? [{ objectId: "cr-1", openBalance: "500.00" }] : [] },
  }));
});

afterEach(cleanup);

describe("REQ-696 — o adiantamento na agenda a receber", () => {
  it("CA-696: a linha do adiantamento leva à página da parte; receber continua oferecido", async () => {
    const onOpenParty = vi.fn();
    render(
      <LanguageProvider>
        <ReceivablesPage canReceive onOperationStarted={() => {}} onOpenParty={onOpenParty} />
      </LanguageProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Compensar" }));

    expect(onOpenParty).toHaveBeenCalledWith(joao);
    // One "Receber" for the advance (beside Compensar), one for the expected commission.
    expect(screen.getAllByRole("button", { name: "Receber" })).toHaveLength(2);
  });

  it("quem só consulta vê, sem compensar", async () => {
    render(
      <LanguageProvider>
        <ReceivablesPage canReceive={false} onOperationStarted={() => {}} onOpenParty={vi.fn()} />
      </LanguageProvider>,
    );

    expect((await screen.findAllByRole("button", { name: "Ver" })).length).toBe(2);
    expect(screen.queryByRole("button", { name: "Compensar" })).toBeNull();
  });
});

describe("REQ-695 — o crédito do pagador escolhido", () => {
  const renderPage = () =>
    render(
      <LanguageProvider>
        <ReceivablesPage canReceive onOperationStarted={() => {}} onOpenParty={vi.fn()} />
      </LanguageProvider>,
    );

  it("CA-695: escolhida a Allianz, que tem comissão em aberto → 'Registrar crédito de Allianz' na própria agenda", async () => {
    renderPage();
    expect(screen.queryByText(/Registrar crédito de/)).toBeNull();

    await choosePayer(/^Allianz/);

    expect(await screen.findByText("Registrar crédito de Allianz")).toBeTruthy();
    expect(insurerReceivables).toHaveBeenCalledWith("allianz");
  });

  it("um pagador sem comissão em aberto (o João, que deve um adiantamento) não ganha o crédito", async () => {
    renderPage();

    await choosePayer(/^João/);

    await vi.waitFor(() => expect(insurerReceivables).toHaveBeenCalledWith("joao"));
    // Let the answer arrive before asserting the absence: an absence checked too early proves nothing.
    await act(async () => {
      await insurerReceivables.mock.results.at(-1)!.value;
    });
    expect(screen.queryByText(/Registrar crédito de/)).toBeNull();
  });
});
