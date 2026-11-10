import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";
import { CURRENCY_SLOT } from "../value-objects/Slot";

/**
 * "Register expected commission" — the usina accrues the commission it EXPECTS to receive, before
 * cash arrives, establishing the baseline a later commission_received reconciles against. Maps to
 * the Ledger's ratified tuple COMMISSION_EXPECTED · COMMISSION_RECEIVABLE · ORIGINATES · NON_CASH ·
 * COMMISSION_ACCRUAL. NO cash moves; the single party is the usina itself (the beneficiary of the
 * future receivable), so no counterparty is collected. English here is the fallback; pt-BR is in the
 * i18n catalog.
 */
export const registerCommissionAccrual: Scenario = {
  id: "register_commission_accrual",
  title: "Register expected commission",
  description: "Record a commission the usina expects to receive before the cash arrives (an accrual; no cash moves).",
  slots: [
    { key: "amount", type: SlotType.MONEY, prompt: "What commission amount is expected?", required: true },
    CURRENCY_SLOT,
    { key: "occurredAt", type: SlotType.DATE, prompt: "On what date did this expectation arise (e.g. the policy was issued)?", required: true },
    {
      // When the money should arrive: a date ahead of today is the ordinary case. Optional, because
      // the document behind the expectation may not say, and left empty it is reported as unknown.
      key: "dueAt",
      type: SlotType.DATE,
      prompt: "When do you expect to receive it? (leave empty if you do not know)",
      required: false,
      allowFuture: true,
    },
    {
      // REQ-274: who is expected to pay — the insurer, the operator. Optional: an expectation can be
      // known before its payer is, and a blank here is recorded as "not stated", never guessed.
      key: "payer",
      type: SlotType.PARTY,
      prompt: "Who is expected to pay it? (optional)",
      required: false,
      suggestionSource: "parties",
    },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
    // Only a rectification fills this: it keeps the restated entry on the position being corrected.
    { key: "restatesObject", type: SlotType.STRING, prompt: "The position this entry restates.", required: false, internal: true },
  ],
  keywords: { "pt-BR": ["provisao", "prevista", "esperada"] },
};
