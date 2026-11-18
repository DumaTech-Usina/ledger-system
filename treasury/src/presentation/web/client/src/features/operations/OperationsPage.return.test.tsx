// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setTypingAnimationDisabled } from "@/hooks/useAnimationsDisabled";
import { LanguageProvider } from "@/i18n/i18n";
import type { User } from "@/types/auth";

/**
 * REQ-690 / CA-690: a conversation opened from a screen offers to go back to it — while it runs, and
 * once it ended — and stops offering once the operator starts a conversation of their own.
 *
 * Written against what the operator sees (a "Voltar para …" button), not against how it is stored.
 */

const submit = vi.fn();

vi.mock("@/features/operations/operationsApi", () => ({
  operationsApi: {
    scenarios: vi.fn(async () => ({ ok: true, status: 200, data: { scenarios: [] } })),
    getIntent: vi.fn(async () => ({
      ok: true,
      status: 200,
      data: { intent: { id: "intent-adopted", status: "awaiting_confirmation" }, history: [] },
    })),
    preview: vi.fn(async () => ({ ok: true, status: 200, data: previewPayload })),
    submit: (...args: unknown[]) => submit(...args),
  },
}));

const { OperationsPage } = await import("@/features/operations/OperationsPage");

const candidate = {
  sourceReference: "intent:adopted",
  eventType: "commission_payment",
  economicEffect: "cash_out",
  occurredAt: "2026-11-18T00:00:00.000Z",
  amount: "300.00",
  currency: "BRL",
  parties: [],
  objects: [{ objectId: "cp:1", objectType: "commission_payable", relation: "settles" }],
  reason: { type: "commission_payment", description: "", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "user", reporterId: "cfo", channel: "web" },
};

const previewPayload = {
  intentId: "intent-adopted",
  scenarioTitle: "Pagar repasse de comissão",
  answers: {},
  candidate,
  partyNames: {},
};

const adopted = {
  intentId: "intent-adopted",
  scenarioId: "register_commission_payment",
  state: { kind: "ready" as const, answered: 4, total: 4 },
  positionLabel: "Obrigação de comissão · R$ 300,00",
};

const user: User = {
  id: "u1",
  email: "cfo@usina.test",
  name: "CFO",
  displayName: "CFO",
  role: "admin",
  status: "active",
  curator: true,
  permissions: ["intent:create", "intent:submit"],
};

const BACK = "Voltar para Agenda a pagar";

function renderPage(overrides: { returnTo?: { nav: string; intentId: string } } = {}) {
  const onReturn = vi.fn();
  const onReturnDiscarded = vi.fn();
  render(
    <LanguageProvider>
      <OperationsPage
        user={user}
        showIntro={false}
        onIntroDone={() => {}}
        adopt={adopted}
        onAdopted={() => {}}
        returnTo={overrides.returnTo ?? { nav: "agenda", intentId: "intent-adopted" }}
        returnLabel="Agenda a pagar"
        onReturn={onReturn}
        onReturnDiscarded={onReturnDiscarded}
      />
    </LanguageProvider>,
  );
  return { onReturn, onReturnDiscarded };
}

beforeEach(() => {
  submit.mockReset();
  submit.mockResolvedValue({
    ok: true,
    status: 200,
    data: { intentId: "intent-adopted", status: "accepted", intentStatus: "accepted", ledgerReference: "evt-1", candidate },
  });
  setTypingAnimationDisabled(true);
  // jsdom has no media playback; the chat's ambient video is not what this is about.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  // Nor scrolling: the chat follows its last message.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("REQ-690 — back to the screen the conversation was opened from", () => {
  it("offers the way back while the conversation runs, and takes it", async () => {
    const { onReturn } = renderPage();

    await screen.findByText("Confirmar e enviar");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BACK) }));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("still offers it once the operation was sent (CA-690)", async () => {
    const { onReturn } = renderPage();

    fireEvent.click(await screen.findByText("Confirmar e enviar"));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("intent-adopted"));

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(BACK) }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("is dropped when the conversation on screen is not the one the screen opened", async () => {
    const { onReturnDiscarded } = renderPage({ returnTo: { nav: "agenda", intentId: "another-intent" } });

    await waitFor(() => expect(onReturnDiscarded).toHaveBeenCalled());
  });
});
