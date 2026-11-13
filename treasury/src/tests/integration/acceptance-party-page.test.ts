import { describe, it, expect } from "vitest";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { PreviewNotices } from "../../core/application/services/PreviewNotices";
import { PreparedBatches } from "../../core/application/services/PreparedBatches";
import { GetPartyPageUseCase, type PartyPageResult } from "../../core/application/use-cases/GetPartyPage";
import { ExternalSignal } from "../../core/domain/entities/ExternalSignal";
import { Intent } from "../../core/domain/entities/Intent";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { InMemoryExternalSignalRepository } from "../../infra/persistence/InMemoryExternalSignalRepository";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryIdentityLinkRepository } from "../../infra/persistence/InMemoryIdentityLinkRepository";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import type { PartyEvent, PositionItem, PositionLifecycle, PositionsPage } from "../../core/application/dtos/LedgerReadModels";
import type { PositionsQuery } from "../../core/application/ports/LedgerReadPort";

/**
 * Acceptance criteria of `docs/requisitos_refinados.md` §8.4 (página da parte, REQ-630–REQ-638) and
 * REQ-239 (lote preparado), written before the code, as decided in round 18 (2026-11-12), and passing
 * since the implementation of the same day. `it.todo` marks what only the screen can show (order of
 * the sections, labels, sorting control) or what depends on a later step (lote and compensation
 * screens, results).
 *
 *   GetPartyPageUseCase(deps).execute(partyId) →
 *     null                                   the Directory does not know the party
 *     { available: false, party }            the Ledger could not be read (REQ-602)
 *     { available: true, party, operation: { usinaOwes, partyOwes, unclassified, truncated },
 *       alerts, receivesAlsoThrough, history, partyNames }
 *
 *   PreparedBatches(audit, clock): prepare({ partyId, items, by }) → { batchId }; discard(batchId, by)
 *   PreviewNotices carries the notice `exceeds_open` (REQ-635).
 */
const TODAY = "2026-11-12T12:00:00.000Z";
const USINA = "party-usina";
const HALISSON = "party-halisson";
const ALLIANZ = "party-allianz";
const JOAO = "party-joao";
const ARGO = "party-argo";
const PROVISIONAL = "prov-maria";
const POLICY = "seguro:apolice:5177";

type Cited = { objectId: string; objectType: string; relation: string };

const event = (
  eventId: string,
  eventType: string,
  economicEffect: string,
  amount: string,
  parties: [string, string][],
  objects: Cited[],
  over: Partial<PartyEvent> = {},
): PartyEvent => ({
  eventId,
  eventType,
  economicEffect,
  amount,
  currency: "BRL",
  occurredAt: "2026-10-21T12:00:00.000Z",
  recordedAt: "2026-10-21T12:00:00.000Z",
  description: null,
  relatedEventId: null,
  objects,
  parties: parties.map(([partyId, role]) => ({ partyId, role, direction: "neutral", amount: null })),
  source: { system: "treasury", reference: `intent:${eventId}` },
  retracted: false,
  ...over,
});

const position = (objectId: string, objectType: string, parties: string[], over: Partial<PositionItem> & { totalSettled?: string } = {}) => ({
  objectId,
  objectType,
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "0.00",
  openBalance: "0.00",
  eventCount: 1,
  lastEventAt: "2026-10-21T12:00:00.000Z",
  originatedAt: "2026-10-21T12:00:00.000Z",
  createdAt: "2026-10-21T12:00:00.000Z",
  dueAt: null,
  parties,
  totalSettled: "0.00",
  ...over,
});
type Position = ReturnType<typeof position>;

/** A Ledger holding these events and positions, answering the reads treasury already uses. */
function book(events: PartyEvent[], positions: Position[], { down = false } = {}) {
  const guard = () => {
    if (down) throw new Error("Ledger unreachable");
  };
  return {
    eventsOfParty: async (id: string) => (guard(), events.filter((e) => e.parties.some((p) => p.partyId === id))),
    event: async (id: string) => (guard(), events.find((e) => e.eventId === id) ?? null),
    positions: async (q: PositionsQuery = {}): Promise<PositionsPage> => {
      guard();
      const ids = q.partyId === undefined ? null : ([] as string[]).concat(q.partyId);
      const statuses = q.status === undefined ? null : ([] as string[]).concat(q.status);
      const data = positions.filter(
        (p) => (!ids || ids.some((id) => (p.parties ?? []).includes(id))) && (!statuses || statuses.includes(p.status)),
      ) as PositionItem[];
      return { data, total: data.length, page: 1, limit: 50, totalPages: 1 };
    },
    lifecycle: async (objectId: string): Promise<PositionLifecycle | null> => {
      guard();
      const citing = events.filter((e) => e.objects.some((o) => o.objectId === objectId));
      if (citing.length === 0) return null;
      const p = positions.find((x) => x.objectId === objectId);
      return {
        objectId,
        objectType: p?.objectType ?? citing[0].objects.find((o) => o.objectId === objectId)!.objectType,
        status: p?.status ?? "open",
        outcome: p?.outcome ?? "pending",
        currency: "BRL",
        totalOriginated: p?.totalOriginated ?? "0.00",
        totalSettled: p?.totalSettled ?? "0.00",
        openBalance: p?.openBalance ?? null,
        eventCount: citing.length,
        events: citing.map((e) => ({
          eventId: e.eventId,
          eventType: e.eventType,
          economicEffect: e.economicEffect,
          relation: e.objects.find((o) => o.objectId === objectId)!.relation,
          amount: e.amount,
          currency: e.currency,
          occurredAt: e.occurredAt,
          recordedAt: e.recordedAt,
          description: e.description,
          relatedEventId: e.relatedEventId,
          retracted: e.retracted,
        })),
        origin: null,
      } as unknown as PositionLifecycle;
    },
  };
}

async function directory() {
  const parties = new InMemoryPartyRepository();
  const save = (partyId: string, displayName: string, identityState = PartyIdentityState.IDENTIFIED) =>
    parties.save({ partyId, displayName, identityState, aliases: [], externalIds: [], attributes: {} });
  await save(USINA, "Usina");
  await save(HALISSON, "Halisson");
  await save(ALLIANZ, "Allianz");
  await save(JOAO, "João Silva");
  await save(ARGO, "Argo Ltda");
  await save(PROVISIONAL, "Maria Souza", PartyIdentityState.PROVISIONAL);
  return new PartyDirectory(parties, undefined, new InMemoryIdentityLinkRepository());
}

async function partyPage(ledger: ReturnType<typeof book>, extra: Record<string, unknown> = {}) {
  const signals = new InMemoryExternalSignalRepository();
  const intents = new InMemoryIntentRepository();
  const useCase = new GetPartyPageUseCase({
    directory: await directory(),
    ledger,
    signals,
    intents,
    clock: { now: () => TODAY },
    ...extra,
  });
  // Typed as a loaded page so each test reads the field it checks; the null and unavailable cases
  // are asserted at runtime by the tests that expect them.
  return { execute: (partyId: string) => useCase.execute(partyId) as Promise<LoadedPage> };
}
type LoadedPage = Extract<PartyPageResult, { available: true }> & { operation: Extract<PartyPageResult, { available: true }>["operation"] };

// ── The book of the examples in §8.4 ─────────────────────────────────────────────────────────────

const contract = (objectId = POLICY): Cited => ({ objectId, objectType: "contract", relation: "references" });

const HALISSON_BOOK = {
  events: [
    event("expected", "commission_expected", "non_cash", "128.77",
      [[ALLIANZ, "payer"], [USINA, "beneficiary"]],
      [{ objectId: "rec-5177", objectType: "commission_receivable", relation: "originates" }, contract()],
      { occurredAt: "2026-10-01T12:00:00.000Z", recordedAt: "2026-10-01T12:00:00.000Z" }),
    event("obligation", "obligation_recognized", "non_cash", "77.26",
      [[USINA, "payer"], [HALISSON, "beneficiary"]],
      [{ objectId: "cp-5177", objectType: "commission_payable", relation: "originates" }, contract()]),
    event("advance", "advance_payment", "cash_out", "50.00",
      [[USINA, "payer"], [HALISSON, "beneficiary"]],
      [{ objectId: "adv-h", objectType: "advance", relation: "originates" }],
      { occurredAt: "2026-10-03T12:00:00.000Z", recordedAt: "2026-10-03T12:00:00.000Z" }),
  ],
  positions: [
    position("rec-5177", "commission_receivable", [ALLIANZ, USINA], { totalOriginated: "128.77", openBalance: "128.77", originatedAt: "2026-10-01T12:00:00.000Z" }),
    position("cp-5177", "commission_payable", [USINA, HALISSON], { totalOriginated: "77.26", openBalance: "77.26" }),
    position("adv-h", "advance", [USINA, HALISSON], { totalOriginated: "50.00", openBalance: "50.00", originatedAt: "2026-10-03T12:00:00.000Z" }),
  ],
};

const halissonLedger = () => book(HALISSON_BOOK.events, HALISSON_BOOK.positions);
const eventIdOf = (h: { kind: string }) => ("eventId" in h ? (h as { eventId: string }).eventId : undefined);
const ids = (lines: { objectId: string }[]) => lines.map((l) => l.objectId).sort();

// ── REQ-630 / REQ-631 — toda parte tem uma página ────────────────────────────────────────────────

describe("REQ-630 — toda parte tem uma página própria", () => {
  it("CA-630: corretor e seguradora têm página, com o nome do cadastro", async () => {
    const page = await partyPage(halissonLedger());

    expect((await page.execute(HALISSON)).party.displayName).toBe("Halisson");
    expect((await page.execute(ALLIANZ)).party.displayName).toBe("Allianz");
  });

  it("CA-630: a provisória tem página e vem marcada como provisória", async () => {
    const page = await partyPage(book([], []));

    const result = await page.execute(PROVISIONAL);

    expect(result.available).toBe(true);
    expect(result.party).toMatchObject({ displayName: "Maria Souza", provisional: true });
  });

  it("parte que o cadastro não conhece → sem página", async () => {
    const page = await partyPage(book([], []));

    expect(await page.execute("party-ninguem")).toBeNull();
  });

  it("REQ-602: Ledger fora do ar → indisponível, nunca uma página vazia", async () => {
    const page = await partyPage(book(HALISSON_BOOK.events, HALISSON_BOOK.positions, { down: true }));

    const result = await page.execute(HALISSON);

    expect(result.available).toBe(false);
    expect(result.operation).toBeUndefined();
  });

  it.todo("CA-630: clicar no nome da parte em qualquer lista abre a página dela");
  it.todo("REQ-630: a visão por parte vira uma lista de partes que leva à página");
  it.todo("CA-630: a provisória mostra \"(provisória)\" junto do nome");
  it.todo("REQ-631: as seções aparecem na ordem Operação, Histórico, Resultados, e a Operação abre primeiro");
  it.todo("REQ-631: Resultados mostra os totais publicados pelo Ledger por período (depende do passo 6, REQ-620)");
});

// ── REQ-632 — Operação ───────────────────────────────────────────────────────────────────────────

describe("REQ-632 — Operação: os dois lados separados, sem líquido", () => {
  it("CA-632: o que a Usina deve ao Halisson e o que ele deve à Usina, cada um do seu lado", async () => {
    const page = await partyPage(halissonLedger());

    const { operation } = await page.execute(HALISSON);

    expect(ids(operation.usinaOwes)).toEqual(["cp-5177"]);
    expect(ids(operation.partyOwes)).toEqual(["adv-h"]);
  });

  it("REJ-632: nenhum saldo líquido entre os dois lados", async () => {
    const page = await partyPage(halissonLedger());

    const result = await page.execute(HALISSON);

    expect(JSON.stringify(result)).not.toMatch(/"net/i);
    expect(JSON.stringify(result)).not.toContain("27.26");
  });

  it("na página da Allianz, a comissão prevista é algo que ela deve à Usina", async () => {
    const page = await partyPage(halissonLedger());

    const { operation } = await page.execute(ALLIANZ);

    expect(ids(operation.partyOwes)).toEqual(["rec-5177"]);
    expect(operation.usinaOwes).toEqual([]);
  });

  it("a comissão prevista da Allianz não é posição do Halisson: ele não é citado nela", async () => {
    const page = await partyPage(halissonLedger());

    const { operation } = await page.execute(HALISSON);

    expect([...ids(operation.usinaOwes), ...ids(operation.partyOwes)]).not.toContain("rec-5177");
  });

  it("CA-632: \"depende de\" traz a expectativa do mesmo contexto, com o que já foi recebido", async () => {
    const page = await partyPage(halissonLedger());

    const { operation } = await page.execute(HALISSON);
    const line = operation.usinaOwes.find((l: { objectId: string }) => l.objectId === "cp-5177")!;

    expect(line.contexts).toEqual([POLICY]);
    expect(line.dependsOn).toEqual([
      expect.objectContaining({ objectId: "rec-5177", payerId: ALLIANZ, openBalance: "128.77", totalSettled: "0.00" }),
    ]);
  });

  it("posição sem contexto não tem \"depende de\"", async () => {
    const page = await partyPage(halissonLedger());

    const { operation } = await page.execute(HALISSON);

    expect(operation.partyOwes.find((l: { objectId: string }) => l.objectId === "adv-h")!.dependsOn).toEqual([]);
  });

  it("cada linha diz há quantos dias a posição está aberta", async () => {
    const page = await partyPage(halissonLedger());

    const { operation } = await page.execute(HALISSON);

    expect(operation.usinaOwes[0].ageDays).toBe(22); // aberta em 21/10, hoje 12/11
    expect(operation.partyOwes[0].ageDays).toBe(40); // aberta em 03/10
  });

  it.todo("REQ-632: cada posição é uma linha (⚠ CONFIRMAR com o uso)");
  it.todo("REQ-632: a ordem é da mais nova (padrão) ou da mais antiga, à escolha de quem olha");
});

// ── REQ-633 — Recebe também por ─────────────────────────────────────────────────────────────────

describe("REQ-633 — recebe também por, sem somar", () => {
  const repasse = event("repasse", "commission_split", "cash_out", "300.00",
    [[USINA, "payer"], [ARGO, "payee"], [JOAO, "beneficiary"]],
    [{ objectId: "cp-joao", objectType: "commission_payable", relation: "settles" }]);

  it("CA-633: a página do João mostra a Argo, pela qual ele recebeu", async () => {
    const page = await partyPage(book([repasse], []));

    const { receivesAlsoThrough } = await page.execute(JOAO);

    expect(receivesAlsoThrough).toEqual([{ partyId: ARGO, displayName: "Argo Ltda" }]);
  });

  it("CA-633: a página da Argo mostra o repasse que ela recebeu para o João", async () => {
    const page = await partyPage(book([repasse], []));

    const { history } = await page.execute(ARGO);

    expect(history.map(eventIdOf)).toContain("repasse");
  });

  it("o bloco não traz nenhum valor: as partes não são somadas", async () => {
    const page = await partyPage(book([repasse], []));

    const { receivesAlsoThrough } = await page.execute(JOAO);

    expect(JSON.stringify(receivesAlsoThrough)).not.toMatch(/\d+\.\d{2}/);
  });
});

// ── REQ-634 — Alertas ────────────────────────────────────────────────────────────────────────────

describe("REQ-634 — alertas da página", () => {
  const unlinkedPayout = event("payout-30", "commission_split", "cash_out", "30.00",
    [[USINA, "payer"], [HALISSON, "beneficiary"]],
    [{ objectId: "cp-solto", objectType: "commission_payable", relation: "settles" }]);
  const unlinkedPayoutPosition = position("cp-solto", "commission_payable", [USINA, HALISSON], {
    totalOriginated: "0.00", openBalance: "0.00", originatedAt: null, totalSettled: "30.00",
  });

  it("CA-634: repasse de comissão sem obrigação gera o alerta", async () => {
    const page = await partyPage(book([unlinkedPayout], [unlinkedPayoutPosition]));

    const { alerts } = await page.execute(HALISSON);

    expect(alerts).toContainEqual(expect.objectContaining({ code: "paid_without_obligation", objectId: "cp-solto" }));
  });

  it("CA-634 / REJ-634: com uma obrigação aberta ao lado, os dois aparecem, e nada afirma \"a mais\"", async () => {
    const obligation = event("ob-20", "obligation_recognized", "non_cash", "20.00",
      [[USINA, "payer"], [HALISSON, "beneficiary"]],
      [{ objectId: "cp-20", objectType: "commission_payable", relation: "originates" }]);
    const page = await partyPage(
      book([unlinkedPayout, obligation], [
        unlinkedPayoutPosition,
        position("cp-20", "commission_payable", [USINA, HALISSON], { totalOriginated: "20.00", openBalance: "20.00" }),
      ]),
    );

    const result = await page.execute(HALISSON);

    expect(result.alerts).toContainEqual(expect.objectContaining({ code: "paid_without_obligation" }));
    expect(ids(result.operation.usinaOwes)).toContain("cp-20");
    expect(JSON.stringify(result.alerts)).not.toMatch(/over|excess|a mais/i);
  });

  it("pagamento de folha sem obrigação não alerta: por enquanto, só o repasse de comissão", async () => {
    const payroll = event("folha", "payroll_payment", "cash_out", "1500.00",
      [[USINA, "payer"], [HALISSON, "payee"]],
      [{ objectId: "pr-solto", objectType: "payroll", relation: "settles" }]);
    const page = await partyPage(
      book([payroll], [position("pr-solto", "payroll", [USINA, HALISSON], { originatedAt: null, totalSettled: "1500.00" })]),
    );

    const { alerts } = await page.execute(HALISSON);

    expect(alerts.filter((a: { code: string }) => a.code === "paid_without_obligation")).toEqual([]);
  });

  it("a provisória traz o alerta de identidade provisória (REQ-321)", async () => {
    const page = await partyPage(book([], []));

    const { alerts } = await page.execute(PROVISIONAL);

    expect(alerts).toContainEqual(expect.objectContaining({ code: "provisional_identity" }));
  });

  it("obrigação com vencimento passado gera alerta; sem vencimento, nunca (REQ-227, §4.1)", async () => {
    const page = await partyPage(
      book(HALISSON_BOOK.events, [
        ...HALISSON_BOOK.positions.filter((p) => p.objectId !== "cp-5177"),
        position("cp-5177", "commission_payable", [USINA, HALISSON], { totalOriginated: "77.26", openBalance: "77.26", dueAt: "2026-11-01" }),
      ]),
    );

    const { alerts } = await page.execute(HALISSON);

    expect(alerts).toContainEqual(expect.objectContaining({ code: "obligation_overdue", objectId: "cp-5177" }));
    expect(alerts.filter((a: { code: string; objectId?: string }) => a.code === "obligation_overdue" && a.objectId !== "cp-5177")).toEqual([]);
  });

  it.todo("REQ-634: comissão prevista sem data esperada aparece com alerta de pendência (REQ-271)");
  it.todo("REQ-634: repasse sem recebimento na apólice aparece com o alerta de REQ-268");
});

// ── REQ-635 — Prevenção do pagamento a mais ──────────────────────────────────────────────────────

describe("REQ-635 — prevenção do pagamento a mais, na prévia", () => {
  const payout = (answers: Record<string, string>) => {
    const intent = Intent.start("i-635", "register_commission_payment", "cfo", TODAY);
    for (const [key, value] of Object.entries(answers)) intent.record(key, value, TODAY);
    return intent;
  };
  const openObligation = position("cp-20", "commission_payable", [USINA, HALISSON], { totalOriginated: "20.00", openBalance: "20.00" });
  const notices = (positions: Position[]) => {
    const ledger = book([], positions);
    return new PreviewNotices({ lifecycle: ledger.lifecycle }, ledger);
  };

  it("CA-635: repasse de 30,00 ligado à obrigação com 20,00 abertos → oferece 20,00 + 10,00 de adiantamento", async () => {
    const result = await notices([openObligation]).for(payout({ payee: HALISSON, amount: "30.00", objectRef: "cp-20" }));

    expect(result).toContainEqual({ code: "exceeds_open", objectId: "cp-20", openBalance: "20.00", excess: "10.00" });
  });

  it("CA-635: repasse de 30,00 sem vínculo, com uma única obrigação aberta de 20,00 → a mesma oferta", async () => {
    const result = await notices([openObligation]).for(payout({ payee: HALISSON, amount: "30.00" }));

    expect(result).toContainEqual({ code: "exceeds_open", objectId: "cp-20", openBalance: "20.00", excess: "10.00" });
  });

  it("repasse dentro do aberto não oferece nada", async () => {
    const result = await notices([openObligation]).for(payout({ payee: HALISSON, amount: "20.00", objectRef: "cp-20" }));

    expect(result.map((n) => n.code)).not.toContain("exceeds_open");
  });

  it.todo("REQ-635: com várias obrigações abertas, o que a prévia oferece (a definir)");
  it.todo("CA-635: escolhida a divisão, vão dois fatos em ordem: o repasse que fecha a obrigação e o adiantamento do excedente");
  it.todo("REQ-635: as opções aparecem em chips, com \"outra\" (DEC-040)");
});

// ── REQ-636 — Histórico ──────────────────────────────────────────────────────────────────────────

describe("REQ-636 — histórico em frases", () => {
  it("só os fatos que citam a parte: a comissão da Allianz não entra no histórico do Halisson", async () => {
    const page = await partyPage(halissonLedger());

    const { history } = await page.execute(HALISSON);

    expect(history.map(eventIdOf).sort()).toEqual(["advance", "obligation"]);
  });

  it("CA-636: cada fato traz a data do fato e a do registro", async () => {
    const late = event("late", "commission_split", "cash_out", "77.26",
      [[USINA, "payer"], [HALISSON, "beneficiary"]],
      [{ objectId: "cp-5177", objectType: "commission_payable", relation: "settles" }],
      { occurredAt: "2026-11-09T12:00:00.000Z", recordedAt: "2026-11-10T15:00:00.000Z" });
    const page = await partyPage(book([late], []));

    const { history } = await page.execute(HALISSON);

    expect(history[0]).toMatchObject({ kind: "fact", occurredAt: "2026-11-09T12:00:00.000Z", recordedAt: "2026-11-10T15:00:00.000Z" });
  });

  it("CA-636: o fato retirado vem marcado, com a retirada que o retirou", async () => {
    const advance = event("adv", "advance_payment", "cash_out", "400.00",
      [[USINA, "payer"], [HALISSON, "beneficiary"]],
      [{ objectId: "adv-x", objectType: "advance", relation: "originates" }], { retracted: true });
    const retraction = event("retr", "ledger_correction", "non_cash", "400.00",
      [[USINA, "platform"], [HALISSON, "beneficiary"]],
      [{ objectId: "adv-x", objectType: "advance", relation: "retracts" }],
      { relatedEventId: "adv", occurredAt: "2026-11-11T12:00:00.000Z", recordedAt: "2026-11-11T12:00:00.000Z" });
    const page = await partyPage(book([advance, retraction], []));

    const { history } = await page.execute(HALISSON);
    const entry = history.find((h) => eventIdOf(h) === "adv");

    expect(entry).toMatchObject({ retracted: true, retractedBy: { eventId: "retr" } });
  });

  it("CA-636 / REJ-636: um sinal ainda não registrado entra, marcado como sinal", async () => {
    const signals = new InMemoryExternalSignalRepository();
    const intents = new InMemoryIntentRepository();
    const proposal = Intent.start("i-sig", "register_obligation_recognition", "system:seguro", TODAY);
    proposal.record("payee", HALISSON, TODAY);
    await intents.save(proposal);
    await signals.add(
      ExternalSignal.record({
        id: "sig-9034",
        system: "insurance",
        kind: "eligibility",
        recordId: "9034",
        fields: { policyId: "9034" },
        contentHash: "a".repeat(64),
        receivedAt: TODAY,
        recordedBy: "system:seguro",
        proposals: [{ fact: "commission_obligation", sourceReference: "seguro:apolice:9034:elegibilidade", intentId: "i-sig", reused: false }],
      }),
    );
    const page = await partyPage(book([], []), { signals, intents });

    const { history, pendingSignals } = await page.execute(HALISSON);

    // Refinement of 2026-11-12: the signals sit in their own block on top of the history, never among the facts.
    expect(pendingSignals).toContainEqual(expect.objectContaining({ kind: "signal", signalId: "sig-9034" }));
    expect(history.filter((h: { kind: string }) => h.kind === "fact")).toEqual([]);
  });

  it("REQ-636: depois de registrado, só o fato aparece; o sinal sai do histórico (decidido em 2026-11-12)", async () => {
    const signals = new InMemoryExternalSignalRepository();
    const intents = new InMemoryIntentRepository();
    const proposal = Intent.start("i-reg", "register_obligation_recognition", "system:seguro", TODAY);
    proposal.record("payee", HALISSON, TODAY);
    proposal.markAwaitingConfirmation(TODAY);
    proposal.markSubmitted(TODAY);
    proposal.markAccepted("evt-1", TODAY);
    await intents.save(proposal);
    await signals.add(
      ExternalSignal.record({
        id: "sig-reg",
        system: "insurance",
        kind: "eligibility",
        recordId: "9034",
        fields: { policyId: "9034" },
        contentHash: "b".repeat(64),
        receivedAt: TODAY,
        recordedBy: "system:seguro",
        proposals: [{ fact: "commission_obligation", sourceReference: "seguro:apolice:9034:elegibilidade", intentId: "i-reg", reused: false }],
      }),
    );
    const page = await partyPage(halissonLedger(), { signals, intents });

    const { pendingSignals } = await page.execute(HALISSON);

    expect(pendingSignals).toEqual([]);
  });

  it.todo("CA-636: a tela mostra as duas datas só quando elas diferem");
  it.todo("REQ-636: cada frase leva à história da apólice que o fato cita (REQ-276)");
  it.todo("REQ-636: o recibo (REQ-245) é aberto a partir da frase");
});

// ── REQ-637 / REQ-638 — Ações e quem vê ──────────────────────────────────────────────────────────

describe("REQ-637 e REQ-638 — ações e quem vê", () => {
  it.todo("REQ-637: cada linha da Operação oferece as ações que já existem a partir da posição (REQ-603)");
  it.todo("REQ-637: o lote nasce na página, selecionando obrigações da parte (passo 4)");
  it.todo("REQ-637: a compensação nasce na página, selecionando posições da mesma parte (passo 7, REQ-252)");
  it.todo("REQ-638: o visualizador vê as três seções, sem as ações");
});

// ── REQ-239 — Lote preparado ─────────────────────────────────────────────────────────────────────

describe("REQ-239 — lote preparado", () => {
  type Recorded = { type: string; actor: { kind: string; id: string } };
  const audit = () => {
    const entries: Recorded[] = [];
    return { entries, record: async (entry: Recorded) => void entries.push(entry) };
  };
  async function batches(log = audit()) {
    return { log, service: new PreparedBatches(log, { now: () => TODAY }) };
  }
  const item = (objectId: string, amount: string) => ({ objectId, amount });

  it("REJ-239: a mesma obrigação não entra em dois lotes preparados", async () => {
    const { service } = await batches();
    await service.prepare({ partyId: HALISSON, items: [item("cp-1", "120.00")], by: "cfo" });

    await expect(service.prepare({ partyId: HALISSON, items: [item("cp-1", "120.00")], by: "cfo" })).rejects.toThrow();
  });

  it("CA-239: descartado, a obrigação volta a poder entrar em outro lote, e o descarte é auditado", async () => {
    const { service, log } = await batches();
    const { batchId } = await service.prepare({ partyId: HALISSON, items: [item("cp-1", "120.00")], by: "cfo" });

    await service.discard(batchId, "cfo");

    await expect(service.prepare({ partyId: HALISSON, items: [item("cp-1", "120.00")], by: "cfo" })).resolves.toBeTruthy();
    expect(log.entries).toContainEqual(expect.objectContaining({ actor: { kind: "user", id: "cfo" } }));
  });

  it.todo("REQ-239: o lote preparado não é fato: prepará-lo ou descartá-lo não envia nada ao Ledger");
  it.todo("REQ-239: o lote preparado aparece na Operação da página da parte");
  it.todo("CA-244 / REJ-244: o extrato de recebível lista as obrigações do lote preparado; um lote não é pago sem ele");
  it.todo("REQ-244: pagar uma obrigação só, direto da posição ou da página, dispensa o extrato");
});
