import { env } from "../../config/env";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import type { Party } from "../../core/domain/entities/Party";
import { INSURANCE_REGISTRY } from "../../core/domain/services/InsuranceSignal";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { RegisterExternalSignalUseCase } from "../../core/application/use-cases/RegisterExternalSignal";
import { RegisterInsurerCreditUseCase } from "../../core/application/use-cases/RegisterInsurerCredit";
import { StartPositionActionUseCase } from "../../core/application/use-cases/StartPositionAction";
import { HttpCandidateSubmissionAdapter } from "../submission/HttpCandidateSubmissionAdapter";
import { HttpLedgerReadAdapter } from "../ledger-read/HttpLedgerReadAdapter";
import { SqliteIntentRepository } from "../persistence/SqliteIntentRepository";
import { SqliteExternalSignalRepository } from "../persistence/SqliteExternalSignalRepository";
import { SqlitePartyRepository } from "../persistence/SqlitePartyRepository";
import { SqliteIdentityLinkRepository } from "../persistence/SqliteIdentityLinkRepository";
import { SqliteAuditLog } from "../audit/SqliteAuditLog";
import { SqliteConversationLog } from "../audit/SqliteConversationLog";
import { SystemClock } from "../system/SystemClock";
import { UuidGenerator } from "../system/UuidGenerator";
import { Role } from "../../core/domain/enums/Role";
import { accessModule } from "../auth/accessModule";

/**
 * TODO-03 (treasury/docs/requisitos_refinados.md §18): a month of the Usina's routine, through
 * the Treasury's own use cases and a real Ledger over HTTP, so the screens can be measured at the
 * volume the owner reported — about 1,140 repasses and payments a week (Q1 2026 mode).
 *
 * Every policy goes the way §4.6 describes: the insurance system registers it (expected commission),
 * later declares it eligible (obligation to the broker), the insurer's credit arrives (receipt, in a
 * batch per insurer), and the Usina pays the broker (repasse). On top, ordinary payments to suppliers.
 * Policies started in the last days stay half-way, as they would: the book has open positions.
 *
 * Never point this at a real book: it writes thousands of facts. It refuses unless LOAD_SIMULATION=yes.
 *
 *   LOAD_SIMULATION=yes LEDGER_MODE=live LEDGER_API_URL=… LEDGER_SUBMIT_TOKEN=… \
 *   OPERATIONS_DB_FILE=… PARTY_DB_FILE=… ACCESS_DB_FILE=… npm run load:month -- [--days=30] [--policies=150] [--payments=80]
 */

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v];
  }),
);
const DAYS = Number(args.days ?? 30);
const POLICIES_PER_DAY = Number(args.policies ?? 150);
const PAYMENTS_PER_DAY = Number(args.payments ?? 80);
const BROKERS = 200;
const INSURERS = 10;
const SUPPLIERS = 30;
/** Business days between the steps of a policy. */
const TO_ELIGIBLE = 5;
const TO_CREDIT = 8;
const TO_REPASSE = 2;
/** The team who signs the month: real users of the test access store, so the screens read them as they would. */
export const SIM_PASSWORD = "senha-de-medicao-de-carga";
const TEAM: [string, Role, string][] = [
  ["cfo@sim.test", Role.ADMIN, "CFO (simulação)"],
  ["verificador1@sim.test", Role.FINANCE_MANAGER, "Verificador 1"],
  ["verificador2@sim.test", Role.FINANCE_MANAGER, "Verificador 2"],
  ["verificador3@sim.test", Role.FINANCE_MANAGER, "Verificador 3"],
];

/** A seeded generator, so two runs simulate the same month. */
let seed = 20261113;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
/** A few brokers sell most: weights 1/rank. The heaviest has hundreds of positions in the month. */
function skewed<T>(xs: T[]): () => T {
  const weights = xs.map((_, i) => 1 / (i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  return () => {
    let r = rand() * total;
    for (let i = 0; i < xs.length; i++) if ((r -= weights[i]) <= 0) return xs[i];
    return xs[xs.length - 1];
  };
}
const money = (min: number, max: number) => (min + rand() * (max - min)).toFixed(2);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function businessDays(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - count);
  for (let i = 0; i < count; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && isoDay(d) < isoDay(new Date())) days.push(isoDay(d));
  }
  return days;
}

function party(partyId: string, displayName: string, externalIds: Party["externalIds"] = []): Party {
  return {
    partyId,
    identityState: PartyIdentityState.IDENTIFIED,
    displayName,
    aliases: [displayName],
    externalIds,
    attributes: {},
    createdBy: "simulacao",
    createdAt: new Date().toISOString(),
  };
}

interface Policy {
  id: string;
  insurer: { partyId: string; externalId: string };
  broker: { partyId: string; externalId: string };
  usinaValue: string;
  payout: string;
  registeredDay: number;
}

async function main(): Promise<void> {
  if (process.env.LOAD_SIMULATION !== "yes") {
    throw new Error("Simulação de carga: escreve milhares de fatos. Rode só contra um livro de teste, com LOAD_SIMULATION=yes.");
  }
  if (env.LEDGER_MODE !== "live") throw new Error("A simulação mede o Ledger de verdade: use LEDGER_MODE=live.");

  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const access = accessModule({ file: env.ACCESS_DB_FILE, clock, publicBaseUrl: env.PUBLIC_BASE_URL });
  const team: string[] = [];
  for (const [email, role, name] of TEAM) {
    const user = (await access.users.findActiveByEmail(email)) ?? (await access.userAdmin.createUserByCommand(email, SIM_PASSWORD, role, name));
    team.push(user.id);
  }
  const AUTHORS = team;
  const CFO = team[0];
  const intents = new SqliteIntentRepository(env.OPERATIONS_DB_FILE);
  const signals = new SqliteExternalSignalRepository(env.OPERATIONS_DB_FILE);
  const audit = new SqliteAuditLog(env.OPERATIONS_DB_FILE);
  const log = new SqliteConversationLog(env.OPERATIONS_DB_FILE);
  const partyRepo = new SqlitePartyRepository(env.PARTY_DB_FILE);
  const directory = new PartyDirectory(partyRepo, undefined, new SqliteIdentityLinkRepository(env.PARTY_DB_FILE));
  const ledger = new HttpLedgerReadAdapter(env.LEDGER_API_URL, env.LEDGER_SUBMIT_TOKEN, undefined, env.USINA_PARTY_ID);

  const applyAnswers = new ApplyAnswersUseCase(intents, clock, log, directory);
  const startIntent = new StartIntentUseCase(intents, clock, ids, log);
  const submit = new SubmitIntentUseCase(
    intents,
    new CandidateMapper(env.USINA_PARTY_ID),
    new HttpCandidateSubmissionAdapter(env.LEDGER_API_URL, env.LEDGER_SUBMIT_TOKEN),
    audit,
    clock,
    directory,
  );
  const registerSignal = new RegisterExternalSignalUseCase(signals, intents, startIntent, applyAnswers, directory, partyRepo, clock, ids);
  const fromPosition = new StartPositionActionUseCase(ledger, ledger, startIntent, applyAnswers, env.USINA_PARTY_ID);
  const registerCredit = new RegisterInsurerCreditUseCase(ledger, fromPosition, startIntent, applyAnswers, submit, clock, ids);

  // ── The parties: brokers and insurers known by their id in the insurance system, and suppliers. ──
  const insurers = Array.from({ length: INSURERS }, (_, i) => ({ partyId: `sim-seguradora-${i + 1}`, externalId: `ins-${i + 1}` }));
  const brokers = Array.from({ length: BROKERS }, (_, i) => ({ partyId: `sim-corretor-${i + 1}`, externalId: `brk-${i + 1}` }));
  const suppliers = Array.from({ length: SUPPLIERS }, (_, i) => `sim-fornecedor-${i + 1}`);
  for (const p of insurers) await partyRepo.save(party(p.partyId, `Seguradora ${p.externalId}`, [{ system: INSURANCE_REGISTRY.insurer, value: p.externalId }]));
  for (const p of brokers) await partyRepo.save(party(p.partyId, `Corretor ${p.externalId}`, [{ system: INSURANCE_REGISTRY.broker, value: p.externalId }]));
  for (const id of suppliers) await partyRepo.save(party(id, `Fornecedor ${id.split("-").pop()}`));
  const nextBroker = skewed(brokers);
  const nextInsurer = skewed(insurers);

  const tally: Record<string, number> = {};
  const count = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
  const submitAll = async (intentIds: string[], userId: string, label: string) => {
    for (const intentId of intentIds) {
      const result = await submit.execute(intentId, userId);
      count(`${label}:${result.intentStatus}`);
    }
  };

  const days = businessDays(DAYS);
  const policies: Policy[] = [];
  const started = Date.now();
  console.log(`[sim] ${days.length} dias úteis, ${POLICIES_PER_DAY} apólices e ${PAYMENTS_PER_DAY} pagamentos por dia`);

  for (let d = 0; d < days.length; d++) {
    const day = days[d];
    const dayStart = Date.now();
    const author = () => pick(AUTHORS);

    // 1. New policies: the expected commission (REQ-262).
    for (let i = 0; i < POLICIES_PER_DAY; i++) {
      const usinaValue = money(80, 2400);
      const policy: Policy = {
        id: `sim-${day.replace(/-/g, "")}-${String(i).padStart(4, "0")}`,
        insurer: nextInsurer(),
        broker: nextBroker(),
        usinaValue,
        payout: (Number(usinaValue) * (0.5 + rand() * 0.3)).toFixed(2),
        registeredDay: d,
      };
      policies.push(policy);
      const result = await registerSignal.execute({
        kind: "policy",
        userId: author(),
        fields: {
          policyId: policy.id,
          insurerId: policy.insurer.externalId,
          brokerId: policy.broker.externalId,
          product: pick(["Auto", "Vida", "Residencial", "Empresarial"]),
          usinaValue: policy.usinaValue,
          registeredAt: day,
        },
      });
      await submitAll(result.proposals.filter((p) => !p.reused).map((p) => p.intentId), author(), "prevista");
    }

    // 2. Eligibility of policies registered a week ago: the obligation to the broker (REQ-262).
    for (const policy of policies.filter((p) => p.registeredDay === d - TO_ELIGIBLE)) {
      const result = await registerSignal.execute({
        kind: "eligibility",
        userId: author(),
        fields: {
          policyId: policy.id,
          insurerId: policy.insurer.externalId,
          brokerId: policy.broker.externalId,
          usinaValue: policy.usinaValue,
          payout: policy.payout,
          eligibleAt: day,
        },
      });
      const obligations = result.proposals.filter((p) => p.sourceReference.endsWith(":elegibilidade") && !p.reused);
      await submitAll(obligations.map((p) => p.intentId), author(), "obrigacao");
    }

    // 3. The insurer's credit, one batch per insurer, for policies registered some days ago (REQ-269).
    const crediting = policies.filter((p) => p.registeredDay === d - TO_CREDIT);
    for (const insurer of insurers) {
      const mine = crediting.filter((p) => p.insurer.partyId === insurer.partyId);
      if (mine.length === 0) continue;
      const total = mine.reduce((sum, p) => sum + Math.round(Number(p.usinaValue) * 100), 0);
      const result = await registerCredit.execute({
        payer: insurer.partyId,
        creditAmount: (total / 100).toFixed(2),
        occurredAt: day,
        allocations: mine.map((p) => ({ objectId: `seguro:apolice:${p.id}:prevista`, amount: p.usinaValue })),
        userId: CFO,
      });
      for (const step of result.steps) count(`recebimento:${step.status}`);
    }

    // 4. Repasses: the broker is paid for what became eligible a couple of days ago.
    for (const policy of policies.filter((p) => p.registeredDay === d - TO_ELIGIBLE - TO_REPASSE)) {
      const { intentId } = await fromPosition.execute({
        objectId: `seguro:apolice:${policy.id}:elegibilidade`,
        scenarioId: "register_commission_payment",
        userId: CFO,
      });
      await applyAnswers.execute({
        intentId,
        answers: [
          { key: "payee", value: policy.broker.partyId },
          { key: "amount", value: policy.payout },
          { key: "currency", value: "BRL" },
          { key: "occurredAt", value: day },
        ],
      });
      await submitAll([intentId], CFO, "repasse");
    }

    // 5. Ordinary payments (suppliers, services): the rest of the week's outflows.
    for (let i = 0; i < PAYMENTS_PER_DAY; i++) {
      const { intentId } = await startIntent.execute({ scenarioId: "register_payment", userId: CFO });
      await applyAnswers.execute({
        intentId,
        answers: [
          { key: "payee", value: pick(suppliers) },
          { key: "amount", value: money(40, 9000) },
          { key: "currency", value: "BRL" },
          { key: "occurredAt", value: day },
          { key: "description", value: "Pagamento simulado" },
        ],
      });
      await submitAll([intentId], CFO, "pagamento");
    }

    console.log(`[sim] ${day}: ${((Date.now() - dayStart) / 1000).toFixed(1)} s · total ${((Date.now() - started) / 60000).toFixed(1)} min`);
  }

  console.log("[sim] resultado por tipo:status");
  for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${k}: ${v}`);
  const heaviest = brokers[0];
  console.log(`[sim] corretor com mais movimento: ${heaviest.partyId}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
