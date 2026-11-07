// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n/i18n";
import { PendingIdentitiesBanner } from "@/features/parties/PendingIdentitiesBanner";
import type { PendingIdentity, RegisteredParty } from "@/features/parties/partiesApi";

const list = vi.fn();
const register = vi.fn();
const link = vi.fn();

vi.mock("@/features/parties/partiesApi", () => ({
  partiesApi: { list: () => list(), register: (i: unknown) => register(i), link: (a: string, b: string) => link(a, b) },
}));

const { PartiesPage } = await import("@/features/parties/PartiesPage");

const pendingMaria: PendingIdentity[] = [{ partyId: "prov-1", displayName: "Maria Souza", kind: "provisional" }];
const argo: RegisteredParty = { partyId: "p-argo", displayName: "Argo", kind: "company", document: "12345678000199", hasBankAccount: true };

const inLanguage = (element: ReturnType<typeof createElement>) => render(createElement(LanguageProvider, null, element));

beforeEach(() => {
  localStorage.setItem("treasury.language", "pt-BR");
  list.mockReset().mockResolvedValue({ ok: true, status: 200, data: { parties: [argo] } });
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

describe("a página de cadastro", () => {
  it("mostra as partes cadastradas com o documento formatado", async () => {
    inLanguage(createElement(PartiesPage, { pending: [], onChanged: vi.fn() }));

    expect(await screen.findByText("Argo")).toBeTruthy();
    expect(screen.getByText("12.345.678/0001-99")).toBeTruthy();
  });

  it("CA-314: mostra a recusa do servidor, traduzida, e não limpa o que foi digitado", async () => {
    register.mockResolvedValue({ ok: false, status: 422, data: { error: "A party with a bank account needs a CPF or CNPJ." } });
    const onChanged = vi.fn();
    inLanguage(createElement(PartiesPage, { pending: [], onChanged }));

    const name = screen.getByLabelText("Nome ou razão social") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("Quem recebe ou paga por conta bancária precisa de CPF ou CNPJ.")).toBeTruthy();
    expect(name.value).toBe("Nova");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("um cadastro aceito limpa o formulário e atualiza a lista", async () => {
    register.mockResolvedValue({ ok: true, status: 201, data: { partyId: "p-nova" } });
    const onChanged = vi.fn();
    inLanguage(createElement(PartiesPage, { pending: [], onChanged }));

    const name = screen.getByLabelText("Nome ou razão social") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Nova" } });
    fireEvent.change(screen.getByLabelText(/CPF ou CNPJ/), { target: { value: "12345678000199" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Nova", kind: "company", hasBankAccount: true, document: "12.345.678/0001-99" }),
    );
    expect(name.value).toBe("");
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("não deixa ligar sem escolher uma parte", async () => {
    inLanguage(createElement(PartiesPage, { pending: pendingMaria, onChanged: vi.fn() }));
    await screen.findByText("Argo");

    expect((screen.getByRole("button", { name: "Ligar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem nenhuma parte cadastrada, diz o que fazer em vez de oferecer uma lista vazia", async () => {
    list.mockResolvedValue({ ok: true, status: 200, data: { parties: [] } });
    inLanguage(createElement(PartiesPage, { pending: pendingMaria, onChanged: vi.fn() }));

    expect(await screen.findByText("Cadastre a parte abaixo para poder ligar.")).toBeTruthy();
  });

  it("uma lista que falhou ao carregar não é confundida com uma lista vazia", async () => {
    list.mockResolvedValue({ ok: false, status: 500, data: {} });
    inLanguage(createElement(PartiesPage, { pending: [], onChanged: vi.fn() }));

    expect(await screen.findByText("Não foi possível carregar o cadastro agora.")).toBeTruthy();
    expect(screen.queryByText("Nenhuma parte cadastrada ainda.")).toBeNull();
  });
});
