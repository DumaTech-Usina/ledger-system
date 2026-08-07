import type { Scenario } from "./Scenario";
import { SlotType } from "../enums/SlotType";

/**
 * "Recognize an obligation" — an external fact established something the usina owes, before any
 * money leaves: an invoice was issued against it, a payroll was closed, a tax was assessed. Maps to
 * the Ledger's ratified tuple OBLIGATION_RECOGNIZED · NON_CASH · ORIGINATES, with the kind of
 * obligation selecting the object type.
 *
 * It serves both orders of arrival, and the same conversation covers them:
 *   - recognize first, pay later — `position` stays empty and a new position is minted;
 *   - pay first, recognize later — the user points at the payment's position, and the recognition
 *     originates THAT one, so the two facts land on a single position instead of two.
 *
 * The second is not a correction and rewrites nothing: it is knowledge arriving late, which the
 * candidate says in its own reason.
 */
export const registerObligationRecognition: Scenario = {
  id: "register_obligation_recognition",
  title: "Recognize an obligation",
  description:
    "Record an obligation the usina owes, established by an external fact (invoice, payroll, tax) before it is paid.",
  slots: [
    {
      key: "kind",
      type: SlotType.CHOICE,
      prompt: "What kind of obligation is it?",
      required: true,
      choices: ["payroll", "service", "infrastructure", "tax", "other"],
    },
    { key: "payee", type: SlotType.PARTY, prompt: "Who is it owed to?", required: true, suggestionSource: "parties" },
    { key: "amount", type: SlotType.MONEY, prompt: "What is the amount owed?", required: true },
    { key: "currency", type: SlotType.CHOICE, prompt: "Which currency?", required: true, choices: ["BRL", "USD"] },
    {
      key: "occurredAt",
      type: SlotType.DATE,
      prompt: "On what date was the obligation established?",
      required: true,
    },
    {
      // Optional continuity assertion: the position of a payment already recorded, which this
      // recognition originates in hindsight. Never required — a recognition that comes first has
      // nothing to point at, and that is the ordinary case, not a gap.
      key: "objectRef",
      type: SlotType.STRING,
      prompt: "Was this obligation already paid? If so, which payment does it explain?",
      required: false,
    },
    { key: "description", type: SlotType.STRING, prompt: "A short description (optional).", required: false },
  ],
  keywords: {
    "pt-BR": ["reconhecer", "reconhecimento", "obrigacao", "nota", "fatura", "competencia", "provisionar"],
  },
};
