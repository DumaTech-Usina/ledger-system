import type {
  CashMovement,
  CommissionInstallment,
  CommissionOrigin,
  CommissionParty,
  PositionItem,
} from "../../core/application/dtos/LedgerReadModels";

/**
 * Demo-only catalog of health-insurance commission data (Operadora > Plano > Proposta > Parcela),
 * shared by InMemoryLedgerSimulator (LEDGER_MODE=simulate) and StubLedgerReadAdapter
 * (LEDGER_MODE=stub) so the two demo modes show the same figures.
 *
 * Each proposal is split into one or more installments (parcelas). A settled installment produces a
 * real CashMovement pair (cash_in on receipt, then either a "repasse" cash_out to the broker or a
 * "multa" cash_out — a penalty the operator charges for that installment); an unreceived proposal or
 * a not-yet-paid-out installment produces only an open PositionItem instead — no cash has moved yet.
 */

const isoDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString();

/** Adds `days` to an ISO date-only string, staying in whole UTC days. */
function plusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Default broker's cut of a received installment, passed through as a cash_out a few days after receipt. */
const REPASSE_LAG_DAYS = 5;

const brokers = {
  ricardo: { name: "Ricardo Almeida", email: "ricardo.almeida@corretoresrj.com.br", cellphoneNumber: "(21) 98877-1234", cpfOrCnpj: "123.456.789-01" },
  fernanda: { name: "Fernanda Souza", email: "fernanda.souza@fsseguros.com.br", cellphoneNumber: "(11) 97766-2345", cpfOrCnpj: "234.567.891-02" },
  marcos: { name: "Marcos Vinícius Lima", email: "marcos.lima@mvlcorretora.com.br", cellphoneNumber: "(31) 96655-3456", cpfOrCnpj: "345.678.912-03" },
  juliana: { name: "Juliana Ferreira Costa", email: "juliana.costa@jfcbrokers.com.br", cellphoneNumber: "(41) 95544-4567", cpfOrCnpj: "456.789.123-04" },
  paulo: { name: "Paulo Henrique Rocha", email: "paulo.rocha@phrseguros.com.br", cellphoneNumber: "(51) 94433-5678", cpfOrCnpj: "567.891.234-05" },
} satisfies Record<string, CommissionParty>;

const clients = {
  acme: { name: "ACME Foods Ltda", email: "financeiro@acmefoods.com.br", cellphoneNumber: "(11) 3344-5566", cpfOrCnpj: "12.345.678/0001-90" },
  graoVerde: { name: "Grão Verde Comércio Ltda", email: "contato@graoverde.com.br", cellphoneNumber: "(11) 3355-6677", cpfOrCnpj: "23.456.789/0001-01" },
  fornecedorSul: { name: "Fornecedor Sul Distribuidora Ltda", email: "contato@fornecedorsul.com.br", cellphoneNumber: "(51) 3366-7788", cpfOrCnpj: "34.567.891/0001-12" },
  bomPreco: { name: "Mercado Bom Preço Ltda", email: "contato@bompreco-mercado.com.br", cellphoneNumber: "(21) 3377-8899", cpfOrCnpj: "45.678.912/0001-23" },
  distribuidoraNorte: { name: "Distribuidora Norte Ltda", email: "contato@distribuidoranorte.com.br", cellphoneNumber: "(85) 3388-9900", cpfOrCnpj: "56.789.123/0001-34" },
  papelariaCentral: { name: "Papelaria Central Ltda", email: "contato@papelariacentral.com.br", cellphoneNumber: "(31) 3399-0011", cpfOrCnpj: "67.891.234/0001-45" },
  carlaMendes: { name: "Carla Mendes", email: "carla.mendes@gmail.com", cellphoneNumber: "(11) 98765-4321", cpfOrCnpj: "678.912.345-06" },
  eduardoTavares: { name: "Eduardo Tavares", email: "eduardo.tavares@gmail.com", cellphoneNumber: "(21) 99876-5432", cpfOrCnpj: "789.123.456-07" },
} satisfies Record<string, CommissionParty>;

interface InstallmentSeed {
  number: number;
  originalValue: string;
  /** Actual cleared ("baixado") amount for the entrada leg; defaults to originalValue when omitted — it can be smaller or larger. */
  entradaAmount?: string;
  brokerCommissionPercent: number;
  outflowReason: "repasse" | "multa";
  /** Only set when outflowReason is "multa" — the flat penalty the operator charges. */
  penaltyAmount?: string;
  /** Only set for status "received" proposals — the date this installment's commission hit the account. */
  occurredAt?: string;
}

interface CommissionSeed {
  proposalNumber: number;
  operatorName: string;
  planDescription: string;
  broker: CommissionParty;
  client: CommissionParty;
  effectiveDate: string;
  status: "received" | "receivable";
  lives: number;
  /** Only meaningful for status "received": has the outflow already been paid out? Defaults to "settled". */
  repasseStatus?: "settled" | "pending";
  installments: InstallmentSeed[];
}

const seeds: CommissionSeed[] = [
  { proposalNumber: 2001, operatorName: "Hapvida", planDescription: "Plano Hapvida Empresarial 100", broker: brokers.ricardo, client: clients.acme, effectiveDate: isoDay(2026, 4, 18), status: "received", lives: 12,
    installments: [{ number: 1, originalValue: "8400.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 4, 20) }] },
  { proposalNumber: 2002, operatorName: "Hapvida", planDescription: "Plano Hapvida Individual Compacto", broker: brokers.fernanda, client: clients.carlaMendes, effectiveDate: isoDay(2026, 5, 2), status: "received", lives: 1,
    installments: [{ number: 1, originalValue: "950.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 5) }] },
  { proposalNumber: 2003, operatorName: "Hapvida", planDescription: "Plano Hapvida Empresarial 100", broker: brokers.marcos, client: clients.distribuidoraNorte, effectiveDate: isoDay(2026, 6, 10), status: "receivable", lives: 18,
    installments: [{ number: 1, originalValue: "12300.00", brokerCommissionPercent: 40, outflowReason: "repasse" }] },
  { proposalNumber: 2004, operatorName: "Amil", planDescription: "Amil Fácil PME", broker: brokers.ricardo, client: clients.graoVerde, effectiveDate: isoDay(2026, 4, 25), status: "received", lives: 8,
    installments: [{ number: 1, originalValue: "6700.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 4, 28) }] },
  { proposalNumber: 2005, operatorName: "Amil", planDescription: "Amil One Nacional", broker: brokers.juliana, client: clients.eduardoTavares, effectiveDate: isoDay(2026, 5, 14), status: "received", lives: 1,
    installments: [{ number: 1, originalValue: "1420.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 16) }] },
  { proposalNumber: 2006, operatorName: "Amil", planDescription: "Amil Fácil PME", broker: brokers.paulo, client: clients.fornecedorSul, effectiveDate: isoDay(2026, 6, 15), status: "receivable", lives: 10,
    installments: [{ number: 1, originalValue: "9100.00", brokerCommissionPercent: 40, outflowReason: "repasse" }] },
  { proposalNumber: 2007, operatorName: "Unimed", planDescription: "Unimed Empresarial Master", broker: brokers.fernanda, client: clients.bomPreco, effectiveDate: isoDay(2026, 5, 8), status: "received", lives: 22,
    installments: [
      { number: 1, originalValue: "6000.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 10) },
      { number: 2, originalValue: "5000.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 20) },
      // Settled above the original value (a late-payment adjustment) — shows entrada can exceed originalValue.
      { number: 3, originalValue: "4400.00", entradaAmount: "4700.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 30) },
    ] },
  { proposalNumber: 2008, operatorName: "Unimed", planDescription: "Unimed Individual Essencial", broker: brokers.marcos, client: clients.carlaMendes, effectiveDate: isoDay(2026, 6, 2), status: "received", lives: 1, repasseStatus: "pending",
    installments: [{ number: 1, originalValue: "880.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 6, 4) }] },
  { proposalNumber: 2009, operatorName: "Unimed", planDescription: "Unimed Empresarial Master", broker: brokers.ricardo, client: clients.papelariaCentral, effectiveDate: isoDay(2026, 6, 18), status: "receivable", lives: 15,
    installments: [{ number: 1, originalValue: "5200.00", brokerCommissionPercent: 40, outflowReason: "repasse" }] },
  { proposalNumber: 2010, operatorName: "Bradesco Saúde", planDescription: "Bradesco Saúde Top Nacional", broker: brokers.juliana, client: clients.acme, effectiveDate: isoDay(2026, 4, 30), status: "received", lives: 6,
    installments: [
      { number: 1, originalValue: "8000.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 1) },
      // Client missed this installment — the operator charges a multa instead of a normal repasse, and it settles below the original value.
      { number: 2, originalValue: "3200.00", entradaAmount: "2800.00", brokerCommissionPercent: 0, outflowReason: "multa", penaltyAmount: "480.00", occurredAt: isoDay(2026, 5, 11) },
    ] },
  { proposalNumber: 2011, operatorName: "Bradesco Saúde", planDescription: "Bradesco Saúde PME", broker: brokers.paulo, client: clients.distribuidoraNorte, effectiveDate: isoDay(2026, 5, 20), status: "received", lives: 9, repasseStatus: "pending",
    installments: [{ number: 1, originalValue: "3400.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 22) }] },
  { proposalNumber: 2012, operatorName: "Bradesco Saúde", planDescription: "Bradesco Saúde PME", broker: brokers.fernanda, client: clients.eduardoTavares, effectiveDate: isoDay(2026, 6, 16), status: "receivable", lives: 4,
    installments: [{ number: 1, originalValue: "1100.00", brokerCommissionPercent: 40, outflowReason: "repasse" }] },
  { proposalNumber: 2013, operatorName: "SulAmérica", planDescription: "SulAmérica Exato", broker: brokers.marcos, client: clients.graoVerde, effectiveDate: isoDay(2026, 5, 5), status: "received", lives: 5,
    installments: [{ number: 1, originalValue: "7300.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 7) }] },
  { proposalNumber: 2014, operatorName: "SulAmérica", planDescription: "SulAmérica Direto", broker: brokers.ricardo, client: clients.carlaMendes, effectiveDate: isoDay(2026, 6, 12), status: "receivable", lives: 2,
    installments: [{ number: 1, originalValue: "940.00", brokerCommissionPercent: 40, outflowReason: "repasse" }] },
  { proposalNumber: 2015, operatorName: "NotreDame Intermédica", planDescription: "Intermédica Smart 200", broker: brokers.juliana, client: clients.fornecedorSul, effectiveDate: isoDay(2026, 5, 25), status: "received", lives: 7, repasseStatus: "pending",
    installments: [{ number: 1, originalValue: "4600.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 5, 27) }] },
  { proposalNumber: 2016, operatorName: "NotreDame Intermédica", planDescription: "Intermédica Empresarial", broker: brokers.paulo, client: clients.bomPreco, effectiveDate: isoDay(2026, 6, 19), status: "receivable", lives: 14,
    installments: [{ number: 1, originalValue: "8900.00", brokerCommissionPercent: 40, outflowReason: "repasse" }] },
  { proposalNumber: 2017, operatorName: "Porto Seguro Saúde", planDescription: "Porto Seguro Efetivo", broker: brokers.fernanda, client: clients.papelariaCentral, effectiveDate: isoDay(2026, 6, 8), status: "received", lives: 3, repasseStatus: "pending",
    installments: [{ number: 1, originalValue: "2200.00", brokerCommissionPercent: 40, outflowReason: "repasse", occurredAt: isoDay(2026, 6, 9) }] },
];

export function buildDemoCommissions(): { movements: CashMovement[]; positions: PositionItem[] } {
  const movements: CashMovement[] = [];
  const positions: PositionItem[] = [];

  for (const seed of seeds) {
    const received = seed.status === "received";
    const totalValue = seed.installments.reduce((sum, i) => sum + Number(i.originalValue), 0).toFixed(2);
    const multiInstallment = seed.installments.length > 1;

    const installments: CommissionInstallment[] = seed.installments.map((inst) => {
      const entrada = inst.entradaAmount ?? inst.originalValue;
      const brokerCommissionValue =
        inst.outflowReason === "repasse" ? (Number(entrada) * (inst.brokerCommissionPercent / 100)).toFixed(2) : "0.00";
      return {
        number: inst.number,
        originalValue: inst.originalValue,
        brokerCommissionPercent: inst.brokerCommissionPercent,
        brokerCommissionValue,
        outflowReason: inst.outflowReason,
        penaltyAmount: inst.penaltyAmount,
      };
    });

    const baseOrigin = {
      kind: "commission" as const,
      operatorName: seed.operatorName,
      planDescription: seed.planDescription,
      proposalNumber: seed.proposalNumber,
      broker: seed.broker,
      client: seed.client,
      effectiveDate: seed.effectiveDate,
      status: seed.status,
      lives: seed.lives,
      totalValue,
      installments,
    };

    let lastEventDate = seed.effectiveDate;

    for (const inst of seed.installments) {
      if (!received || !inst.occurredAt) continue;

      const entrada = inst.entradaAmount ?? inst.originalValue;
      const docSuffix = multiInstallment ? `-${inst.number}` : "";
      lastEventDate = inst.occurredAt;

      movements.push({
        eventId: `e-com-${seed.proposalNumber}-${inst.number}`,
        occurredAt: inst.occurredAt,
        recordedAt: inst.occurredAt,
        effect: "cash_in",
        amount: entrada,
        sourceReference: `COM-${seed.proposalNumber}${docSuffix}`,
        counterparty: seed.operatorName,
        description: `Comissão recebida — ${seed.operatorName}`,
        category: "saude",
        origin: { ...baseOrigin, installmentNumber: inst.number },
      });

      const isMulta = inst.outflowReason === "multa";
      const outflowAmount = isMulta ? inst.penaltyAmount! : (Number(entrada) * (inst.brokerCommissionPercent / 100)).toFixed(2);
      const outflowAt = plusDays(inst.occurredAt, REPASSE_LAG_DAYS);
      const outflowOrigin: CommissionOrigin = { ...baseOrigin, installmentNumber: inst.number, outflowReason: inst.outflowReason };

      if (seed.repasseStatus === "pending") {
        positions.push({
          objectId: `${isMulta ? "penalty" : "commission-payable"}:${seed.proposalNumber}-${inst.number}`,
          objectType: isMulta ? "penalty" : "commission_payable",
          status: "open",
          outcome: "pending",
          currency: "BRL",
          totalOriginated: outflowAmount,
          openBalance: outflowAmount,
          eventCount: 1,
          lastEventAt: outflowAt,
          category: "saude",
          origin: outflowOrigin,
        });
      } else {
        movements.push({
          eventId: `e-out-${seed.proposalNumber}-${inst.number}`,
          occurredAt: outflowAt,
          recordedAt: outflowAt,
          effect: "cash_out",
          amount: outflowAmount,
          sourceReference: `${isMulta ? "MUL" : "REP"}-${seed.proposalNumber}${docSuffix}`,
          counterparty: isMulta ? seed.operatorName : seed.broker.name,
          description: isMulta ? `Multa — ${seed.operatorName}` : `Repasse de comissão — ${seed.broker.name}`,
          category: "saude",
          origin: outflowOrigin,
        });
      }
    }

    // One aggregate settled/open position for the whole proposal (historical marker / receivable).
    positions.push({
      objectId: `commission:${seed.proposalNumber}`,
      objectType: "commission",
      status: received ? "fully_settled" : "open",
      outcome: received ? "gain" : "pending",
      currency: "BRL",
      totalOriginated: totalValue,
      openBalance: received ? "0.00" : totalValue,
      eventCount: seed.installments.length,
      lastEventAt: lastEventDate,
      category: "saude",
      origin: { ...baseOrigin, installmentNumber: seed.installments[seed.installments.length - 1].number },
    });
  }

  return { movements, positions };
}
