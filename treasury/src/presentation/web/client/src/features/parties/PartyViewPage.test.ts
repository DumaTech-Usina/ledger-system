// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n/i18n";

const names = vi.fn();
const page = vi.fn();
const side = vi.fn();
const history = vi.fn();

vi.mock("@/features/parties/partiesApi", () => ({
  partiesApi: { names: () => names(), page: (id: string) => page(id), side: (...args: unknown[]) => side(...args), history: (...args: unknown[]) => history(...args) },
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
  reporter: { type: "user", id: "user-cfo", name: "Diretoria financeira" },
  retractedBy: null,
};

type Lines = { usinaOwes?: unknown[]; partyOwes?: unknown[]; unclassified?: unknown[] };
const info = (n: number) => ({ total: n, page: 1, limit: 20, totalPages: n === 0 ? 0 : Math.ceil(n / 20) });
/** The operation block as the server sends it: the first page of each side, with the Ledger's count. */
const ops = ({ usinaOwes = [], partyOwes = [], unclassified = [] }: Lines = {}, totals: Partial<Record<keyof Lines, number>> = {}) => ({
  usinaOwes,
  partyOwes,
  unclassified,
  pages: {
    usinaOwes: info(totals.usinaOwes ?? usinaOwes.length),
    partyOwes: info(totals.partyOwes ?? partyOwes.length),
    unclassified: info(totals.unclassified ?? unclassified.length),
  },
  kinds: { usinaOwes: ["commission_payable", "payable"], partyOwes: ["advance", "loan"], unclassified: [] },
});

const loaded = {
  operation: ops(),
  historyPage: { total: 0, page: 1, limit: 20, totalPages: 0, facets: { eventTypes: [], reporters: [] } },
  pendingSignals: [],
  alerts: [],
  receivesAlsoThrough: [],
};

const open = async (tab?: string) => {
  render(createElement(LanguageProvider, null, createElement(PartyViewPage)));
  fireEvent.click(await screen.findByRole("button", { name: "João Silva" }));
  if (tab) fireEvent.click(await screen.findByRole("tab", { name: tab }));
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
  page.mockReset();
  side.mockReset();
  history.mockReset();
});

afterEach(cleanup);

describe("a visão por parte", () => {
  it("mostra o evento, o papel e quem mais está nele, pelo nome", async () => {
    page.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        available: true,
        party,
        identifiers: ["joao"],
        ...loaded, history: [{ kind: "fact", ...baseEvent, eventId: "e1", amount: "100.00", retracted: false }],
        partyNames: { argo: "Argo Ltda" },
      },
    });

    await open("Histórico");

    expect((await screen.findAllByText("Diretoria financeira")).length).toBeGreaterThan(0);
    fireEvent.click(document.querySelector("li > button[aria-expanded]")!);
    expect(await screen.findByText("Argo Ltda")).toBeTruthy();
    expect(page).toHaveBeenCalledWith("joao");
  });

  it("marca a identidade provisória na lista", async () => {
    render(createElement(LanguageProvider, null, createElement(PartyViewPage)));

    expect(await screen.findByRole("button", { name: "Maria (provisória)" })).toBeTruthy();
  });

  it("REQ-524: um lançamento retirado aparece, marcado como retirado", async () => {
    page.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        available: true,
        party,
        identifiers: ["joao"],
        ...loaded, history: [{ kind: "fact", ...baseEvent, eventId: "e1", amount: "400.00", retracted: true }],
        partyNames: {},
      },
    });

    await open("Histórico");

    expect(await screen.findByText("Retirado")).toBeTruthy();
  });

  it("não mostra \"Registrado também como\" (removido no refinamento de 2026-11-12)", async () => {
    page.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, party, identifiers: ["joao", "J. SILVA"], ...loaded, history: [], partyNames: {} },
    });

    await open();
    await screen.findByRole("tab", { name: "Operação" });

    expect(screen.queryByText(/Registrado também como/)).toBeNull();
  });

  it("nenhum evento é uma resposta, e diz isso", async () => {
    page.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, party, identifiers: ["joao"], ...loaded, history: [], partyNames: {} },
    });

    await open("Histórico");

    expect(await screen.findByText("Nenhum fato registrado nem sinal recebido sobre esta parte até agora.")).toBeTruthy();
  });

  it("REQ-602: Ledger fora do ar não se confunde com nenhum evento", async () => {
    page.mockResolvedValue({ ok: true, status: 200, data: { available: false, party } });

    await open();

    expect(await screen.findByText(/Não foi possível ler o Ledger/)).toBeTruthy();
    expect(screen.queryByText("Nenhum fato registrado nem sinal recebido sobre esta parte até agora.")).toBeNull();
  });

  it("um erro do servidor também aparece como indisponível, e não como uma tela em branco", async () => {
    page.mockResolvedValue({ ok: false, status: 500, data: { error: "boom" } });

    await open();

    expect(await screen.findByText(/Não foi possível ler o Ledger/)).toBeTruthy();
  });

  it("uma falha de rede também aparece como indisponível", async () => {
    page.mockRejectedValue(new Error("offline"));

    await open();

    expect(await screen.findByText(/Não foi possível ler o Ledger/)).toBeTruthy();
  });
});

describe("a página da parte (§8.4)", () => {
  const line = (objectId: string, objectType: string, openBalance: string, over: Record<string, unknown> = {}) => ({
    objectId, objectType, status: "open", openBalance, totalOriginated: openBalance,
    originatedAt: "2026-10-21T12:00:00.000Z", dueAt: null, ageDays: 22, contexts: [], dependsOn: [], ...over,
  });
  const withPage = (over: Record<string, unknown>) =>
    page.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, party, identifiers: ["joao"], ...loaded, history: [], partyNames: {}, ...over },
    });

  it("CA-632: os dois lados separados, com a idade, o \"depende de\" e nenhum líquido", async () => {
    withPage({
      operation: ops({
        usinaOwes: [line("cp-5177", "commission_payable", "77.26", {
          contexts: ["seguro:apolice:5177"],
          dependsOn: [{ objectId: "rec", objectType: "commission_receivable", payerId: "allianz", payerName: "Allianz", openBalance: "128.77", totalSettled: "0.00", context: "seguro:apolice:5177" }],
        })],
        partyOwes: [line("adv-h", "advance", "50.00", { ageDays: 40 })],
      }),
    });

    await open();

    expect(await screen.findByText("João Silva tem a receber da Usina")).toBeTruthy();
    expect(screen.getByText("João Silva deve à Usina")).toBeTruthy();
    expect(screen.getAllByText("1 em aberto")).toHaveLength(2);
    expect(screen.getByText(/aberta há 22 dias/)).toBeTruthy();
    expect(screen.getByText(/aberta há 40 dias/)).toBeTruthy();
    expect(screen.getByText(/Allianz deve/).textContent).toMatch(/recebido/);
    expect(screen.getByText(/não há saldo líquido/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/27,26/);
  });

  it("REQ-631: as abas vêm na ordem Operação, Histórico, Resultados, com a Operação aberta", async () => {
    withPage({});

    await open();

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Operação", "Histórico", "Resultados"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Nada em aberto com João Silva agora/)).toBeTruthy();
  });

  it("clicar numa aba mostra só o conteúdo dela", async () => {
    withPage({});

    await open("Resultados");

    expect(await screen.findByText(/passo 6/)).toBeTruthy();
    expect(screen.queryByText(/Nada em aberto com João Silva agora/)).toBeNull();
    expect(screen.getByRole("tab", { name: "Resultados" }).getAttribute("aria-selected")).toBe("true");
  });

  it("REQ-630: a parte abre na página dela, sem a lista, e volta para a lista", async () => {
    withPage({});

    await open();

    expect(screen.queryByLabelText("Buscar parte")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voltar para a lista/ }));
    expect(await screen.findByRole("button", { name: "Maria (provisória)" })).toBeTruthy();
  });

  it("a lista de partes é uma lista ordenada, em ordem alfabética", async () => {
    render(createElement(LanguageProvider, null, createElement(PartyViewPage)));

    const list = await screen.findByRole("list", { name: "Partes" });
    expect(list.tagName).toBe("OL");
    await screen.findByRole("button", { name: "João Silva" });
    expect([...list.querySelectorAll("button")].map((b) => b.textContent?.replace("›", "").trim())).toEqual(["João Silva", "Maria (provisória)"]);
  });

  it("sem nenhuma posição, a Operação diz isso numa frase, e não mostra blocos vazios", async () => {
    withPage({});

    await open();

    expect(await screen.findByText("Nada em aberto com João Silva agora: nenhuma posição a pagar nem a receber.")).toBeTruthy();
    expect(screen.queryByText(/tem a receber da Usina/)).toBeNull();
    expect(screen.queryByText(/não há saldo líquido/)).toBeNull();
  });

  it("um lado sem posição diz \"Nada em aberto.\", e o outro mostra as suas", async () => {
    withPage({ operation: ops({ partyOwes: [line("adv-h", "advance", "50.00")] }) });

    await open();

    expect(await screen.findByText("Nada em aberto.")).toBeTruthy();
    expect(screen.getByText("João Silva deve à Usina")).toBeTruthy();
  });

  it("cada lado mostra a contagem do Ledger e pagina por conta própria", async () => {
    withPage({ operation: ops({ usinaOwes: [line("cp-1", "commission_payable", "10.00")] }, { usinaOwes: 137 }) });
    side.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, side: "usinaOwes", lines: [line("cp-21", "commission_payable", "21.00")], total: 137, page: 2, limit: 20, totalPages: 7 },
    });

    await open();
    expect(await screen.findByText("137 em aberto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Próxim/ }));

    expect(await screen.findByText(/21,00/)).toBeTruthy();
    expect(side).toHaveBeenCalledWith("joao", "usinaOwes", expect.objectContaining({ page: 2, limit: 20, sortBy: "createdAt", sortOrder: "DESC" }));
  });

  it("o \"depende de\" é um indicador curto na linha; os detalhes abrem ao clicar", async () => {
    withPage({
      operation: ops({
        usinaOwes: [line("cp-5177", "commission_payable", "77.26", {
          contexts: ["seguro:apolice:5177"],
          dependsOn: [{ objectId: "rec", objectType: "commission_receivable", payerId: "allianz", payerName: "Allianz", openBalance: "128.77", totalSettled: "0.00", context: "seguro:apolice:5177" }],
        })],
      }),
    });

    await open();
    expect((await screen.findByText(/↳/)).textContent).toMatch(/Allianz deve/);
    expect(screen.queryByText("cp-5177")).toBeNull();

    fireEvent.click(screen.getByText(/↳/).closest("button")!);

    expect(await screen.findByText("cp-5177")).toBeTruthy();
  });

  it("REQ-602: um lado que não pôde ser lido diz isso, e não \"nada em aberto\"", async () => {
    withPage({ operation: ops({ partyOwes: [line("adv-h", "advance", "50.00")] }, { partyOwes: 30 }) });
    side.mockResolvedValue({ ok: true, status: 200, data: { available: false } });

    await open();
    await screen.findByText("30 em aberto");
    fireEvent.click(screen.getByRole("button", { name: /Próxim/ }));

    expect(await screen.findByText(/Isso não quer dizer que não há posições/)).toBeTruthy();
  });

  it("REQ-634: mostra os alertas, sem afirmar pagamento a mais", async () => {
    withPage({ alerts: [{ code: "paid_without_obligation", objectId: "cp-solto" }] });

    await open();

    expect((await screen.findByText(/sem obrigação registrada/)).textContent).not.toMatch(/a mais/);
  });

  it("CA-636: o sinal entra marcado como sinal, e as duas datas aparecem quando diferem", async () => {
    withPage({
      pendingSignals: [{ kind: "signal", signalId: "s1", receivedAt: "2026-11-12T12:00:00.000Z", signalKind: "eligibility", recordId: "9034", proposals: [] }],
      history: [
        { kind: "fact", ...baseEvent, eventId: "late", amount: "77.26", retracted: false, occurredAt: "2026-11-09T12:00:00.000Z", recordedAt: "2026-11-10T15:00:00.000Z" },
      ],
    });

    await open("Histórico");

    expect(await screen.findByText("Sinal, ainda não registrado")).toBeTruthy();
    expect(screen.getByText("Sinais aguardando registro (1)")).toBeTruthy();
    expect(screen.getByText(/fato de 9 de nov/)).toBeTruthy();
  });

  it("CA-633: \"recebe também por\" leva à página da outra parte", async () => {
    withPage({ receivesAlsoThrough: [{ partyId: "argo", displayName: "Argo Ltda" }] });

    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Argo Ltda" }));

    await screen.findByText(/Recebe também por/);
    expect(page).toHaveBeenCalledWith("argo");
  });

  it("CA-630: a provisória mostra \"(provisória)\" junto do nome", async () => {
    page.mockResolvedValue({
      ok: true, status: 200,
      data: { available: true, party: { partyId: "prov", displayName: "Maria", provisional: true }, identifiers: ["prov"], ...loaded, history: [], partyNames: {} },
    });
    render(createElement(LanguageProvider, null, createElement(PartyViewPage)));
    fireEvent.click(await screen.findByRole("button", { name: "Maria (provisória)" }));

    expect(await screen.findByRole("heading", { name: "Maria (provisória)" })).toBeTruthy();
  });
});

describe("o histórico de auditoria (refinamento de 2026-11-12)", () => {
  const fact = (eventId: string, over: Record<string, unknown> = {}) => ({ kind: "fact", ...baseEvent, eventId, amount: "10.00", retracted: false, ...over });
  const withHistory = (entries: unknown[], total = entries.length, facets = { eventTypes: [], reporters: [] }) =>
    page.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        available: true, party, identifiers: ["joao"], ...loaded, partyNames: {},
        history: entries,
        historyPage: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20), facets },
      },
    });

  it("mostra a contagem de registros e quem registrou cada fato", async () => {
    withHistory([fact("e1")], 1284);

    await open("Histórico");

    expect(await screen.findByText("1.284 registros")).toBeTruthy();
    expect(screen.getAllByText("Diretoria financeira").length).toBeGreaterThan(0);
  });

  it("o fato retirado diz quando e por quem foi retirado", async () => {
    withHistory([
      fact("adv", {
        retracted: true,
        retractedBy: { eventId: "retr", occurredAt: "2026-11-11T12:00:00.000Z", recordedAt: "2026-11-11T12:00:00.000Z", reporter: { type: "user", id: "user-gestora", name: "Gestora" } },
      }),
    ]);

    await open("Histórico");

    expect((await screen.findByText(/Retirado em/)).textContent).toMatch(/por Gestora/);
  });

  it("pagina pelo servidor, na ordem de registro", async () => {
    withHistory([fact("e1")], 45);
    history.mockResolvedValue({
      ok: true,
      status: 200,
      data: { available: true, entries: [fact("e21", { amount: "21.00" })], total: 45, page: 2, limit: 20, totalPages: 3, facets: { eventTypes: [], reporters: [] } },
    });

    await open("Histórico");
    await screen.findByText("45 registros");
    fireEvent.click(screen.getByRole("button", { name: /Próxim/ }));

    expect(await screen.findByText(/21,00/)).toBeTruthy();
    expect(history).toHaveBeenCalledWith("joao", expect.objectContaining({ page: 2, sortOrder: "DESC", status: "all" }));
  });

  it("REQ-602: uma página do histórico que não pôde ser lida diz isso", async () => {
    withHistory([fact("e1")], 45);
    history.mockResolvedValue({ ok: true, status: 200, data: { available: false } });

    await open("Histórico");
    await screen.findByText("45 registros");
    fireEvent.click(screen.getByRole("button", { name: /Próxim/ }));

    expect(await screen.findByText(/Não foi possível ler o Ledger/)).toBeTruthy();
  });

  it("sem sinais pendentes, o bloco de sinais não aparece", async () => {
    withHistory([fact("e1")]);

    await open("Histórico");
    await screen.findByText("1 registro");

    expect(screen.queryByText(/Sinais aguardando registro/)).toBeNull();
  });
});
