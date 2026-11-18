// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LanguageProvider } from "@/i18n/i18n";
import { PendingIdentitiesBanner } from "@/features/parties/PendingIdentitiesBanner";
import type { PartyName, PendingIdentity } from "@/features/parties/partiesApi";

const names = vi.fn();
const register = vi.fn();
const link = vi.fn();

vi.mock("@/features/parties/partiesApi", () => ({
  partiesApi: { names: () => names(), register: (i: unknown) => register(i), link: (a: string, b: string) => link(a, b) },
}));

const { PartyViewPage } = await import("@/features/parties/PartyViewPage");

const pendingMaria: PendingIdentity[] = [{ partyId: "prov-1", displayName: "Maria Souza", kind: "provisional" }];
const argo: PartyName = { partyId: "p-argo", displayName: "Argo", state: "identified", kind: "company", document: "12345678000199", hasBankAccount: true };
const maria: PartyName = { partyId: "prov-1", displayName: "Maria Souza", state: "provisional", kind: null, document: null, hasBankAccount: null };

const inLanguage = (element: ReturnType<typeof createElement>) => render(createElement(LanguageProvider, null, element));
const page = (props: { canCurate?: boolean; pending?: PendingIdentity[]; onChanged?: () => void }) =>
  inLanguage(createElement(PartyViewPage, { canCurate: true, pending: [], onChanged: vi.fn(), ...props }));

beforeEach(() => {
  localStorage.setItem("treasury.language", "pt-BR");
  names.mockReset().mockResolvedValue({ ok: true, status: 200, data: { parties: [argo, maria] } });
  register.mockReset();
  link.mockReset();
});

afterEach(cleanup);

describe("REQ-321 — a notificação", () => {
  it("aparece com quem está pendente, e não tem como ser fechada", () => {
    inLanguage(createElement(PendingIdentitiesBanner, { pending: pendingMaria }));

    expect(screen.getByRole("alert").textContent).toContain("Maria Souza");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("some só quando não há nada pendente", () => {
    inLanguage(createElement(PendingIdentitiesBanner, { pending: [] }));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("quem tem curadoria recebe o caminho para resolver", () => {
    const onResolve = vi.fn();
    inLanguage(createElement(PendingIdentitiesBanner, { pending: pendingMaria, onResolve }));

    fireEvent.click(screen.getByRole("button", { name: "Resolver" }));

    expect(onResolve).toHaveBeenCalled();
  });
});

describe("REQ-315 — Partes: uma tela só", () => {
  it("a lista mostra tipo, documento formatado e conta bancária; a provisória só com o rótulo", async () => {
    page({ canCurate: false });

    expect(await screen.findByText("Argo")).toBeTruthy();
    expect(screen.getByText("Empresa · 12.345.678/0001-99 · Conta bancária: sim")).toBeTruthy();
    expect(screen.getByText("(provisória)")).toBeTruthy();
  });

  it("quem não tem curadoria vê as identidades sem resolução, sem poder ligar nem cadastrar", async () => {
    page({ canCurate: false, pending: pendingMaria });
    await screen.findByText("Argo");

    const section = screen.getByText("Identidades sem resolução").closest("div")!;
    expect(within(section).getAllByText("Maria Souza").length).toBeGreaterThan(0);
    expect(screen.getByText(/Quem tem curadoria resolve estas identidades/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ligar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cadastrar e ligar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cadastrar parte" })).toBeNull();
  });

  it("sem nada pendente, a seção não aparece", async () => {
    page({});
    await screen.findByText("Argo");

    expect(screen.queryByText("Identidades sem resolução")).toBeNull();
  });

  it("não deixa ligar sem escolher uma parte", async () => {
    page({ pending: pendingMaria });
    await screen.findByText("Argo");

    expect((screen.getByRole("button", { name: "Ligar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem nenhuma parte cadastrada, diz o que fazer em vez de oferecer uma lista vazia", async () => {
    names.mockResolvedValue({ ok: true, status: 200, data: { parties: [maria] } });
    page({ pending: pendingMaria });

    expect(await screen.findByText("Nenhuma parte cadastrada para ligar. Use “Cadastrar e ligar”.")).toBeTruthy();
  });

  it("uma lista que falhou ao carregar não é confundida com uma lista vazia", async () => {
    names.mockResolvedValue({ ok: false, status: 500, data: {} });
    page({});

    expect(await screen.findByText("Não foi possível carregar o cadastro agora.")).toBeTruthy();
    expect(screen.queryByText("Nenhuma parte cadastrada ainda.")).toBeNull();
  });
});

describe("REQ-315 — o cadastro num modal", () => {
  it("CA-314: mostra a recusa do servidor, traduzida, e não limpa o que foi digitado", async () => {
    register.mockResolvedValue({ ok: false, status: 422, data: { error: "A party with a bank account needs a CPF or CNPJ." } });
    const onChanged = vi.fn();
    page({ onChanged });
    await screen.findByText("Argo");

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar parte" }));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("Nome ou razão social") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Nova" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar" }));

    expect(await within(dialog).findByText("Quem recebe ou paga por conta bancária precisa de CPF ou CNPJ.")).toBeTruthy();
    expect(name.value).toBe("Nova");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("um cadastro aceito fecha o modal, mostra o aviso e atualiza a lista", async () => {
    register.mockResolvedValue({ ok: true, status: 201, data: { partyId: "p-nova" } });
    const onChanged = vi.fn();
    page({ onChanged });
    await screen.findByText("Argo");

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar parte" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome ou razão social"), { target: { value: "Nova" } });
    fireEvent.change(within(dialog).getByLabelText(/CPF ou CNPJ/), { target: { value: "12345678000199" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Nova", kind: "company", hasBankAccount: true, document: "12.345.678/0001-99" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Nova cadastrado(a).")).toBeTruthy();
    expect(names).toHaveBeenCalledTimes(2);
    expect(link).not.toHaveBeenCalled();
  });

  it("REQ-322: “Cadastrar e ligar” traz o nome da provisória, avisa que a ligação não se desfaz, cadastra e liga", async () => {
    register.mockResolvedValue({ ok: true, status: 201, data: { partyId: "p-maria" } });
    link.mockResolvedValue({ ok: true, status: 201, data: { link: {} } });
    const onChanged = vi.fn();
    page({ pending: pendingMaria, onChanged });
    await screen.findByText("Argo");

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar e ligar" }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("Nome ou razão social") as HTMLInputElement).value).toBe("Maria Souza");
    expect(within(dialog).getByText(/não pode ser desfeita/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Recebe ou paga por conta bancária/), { target: { value: "no" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar e ligar" }));

    await waitFor(() => expect(link).toHaveBeenCalledWith("prov-1", "p-maria"));
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Maria Souza" }));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Maria Souza cadastrado(a) e ligado(a) a “Maria Souza”.")).toBeTruthy();
  });

  it("se a ligação falhar depois do cadastro, diz que a parte foi cadastrada e o que falta", async () => {
    register.mockResolvedValue({ ok: true, status: 201, data: { partyId: "p-maria" } });
    link.mockResolvedValue({ ok: false, status: 500, data: { error: "boom" } });
    page({ pending: pendingMaria });
    await screen.findByText("Argo");

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar e ligar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cadastrar e ligar" }));

    expect(await screen.findByText(/foi cadastrado\(a\), mas a ligação não foi feita/)).toBeTruthy();
    expect(register).toHaveBeenCalledTimes(1);
  });
});
