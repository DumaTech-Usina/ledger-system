import { SlotType } from "../../core/domain/enums/SlotType";
import type { SlotDefinition } from "../../core/domain/value-objects/Slot";
import type {
  ScenarioCatalogEntry,
  SlotExtractionPort,
  SlotExtractionRequest,
  SlotExtractionResult,
  SlotProposal,
} from "../../core/application/ports/SlotExtractionPort";

/**
 * STUB deterministic extractor standing in for a real model until the workflow is complete. It uses
 * only regex/keyword rules per slot type — no learning, no external call — so the whole extract →
 * merge → next-question loop is provable and reproducible now. It also serves as the permanent test
 * double (mirrors StubCandidateSubmissionAdapter). When a real model lands, only a sibling adapter
 * behind SlotExtractionPort changes; nothing in core moves.
 *
 * Deliberately conservative: it proposes only what a rule can match with confidence, leaves the rest
 * unfilled (so the deterministic engine asks for it), never proposes an unknown key, and never throws.
 */
export class StubSlotExtractionAdapter implements SlotExtractionPort {
  // Fixed confidences per match kind keep output deterministic and let a threshold discriminate.
  private static readonly STRONG = 0.9; // unambiguous regex match (money, ISO date)
  private static readonly MEDIUM = 0.75; // keyword/name match (choice token, known party)

  async extract(request: SlotExtractionRequest): Promise<SlotExtractionResult> {
    const text = request.utterance ?? "";

    // Classify mode: pick a scenario from the catalog, then extract for its slots. If no scenario
    // can be confidently chosen, ask to clarify and propose nothing.
    if (request.scenarios) {
      const chosen = this.classify(text, request.scenarios);
      if (!chosen) {
        return { clarification: this.clarificationFor(request.scenarios), slots: [] };
      }
      return { scenarioId: chosen.id, slots: this.extractSlots(chosen.slots, text, request.knownParties ?? []) };
    }

    // Bound mode: extract for the supplied slots of the scenario already in play.
    return { slots: this.extractSlots(request.slots ?? [], text, request.knownParties ?? []) };
  }

  private extractSlots(
    slots: SlotDefinition[],
    text: string,
    knownParties: { partyId: string; name: string }[],
  ): SlotProposal[] {
    const out: SlotProposal[] = [];
    for (const slot of slots) {
      const proposal = this.proposeForSlot(slot, text, knownParties);
      if (proposal) out.push(proposal);
    }
    return out;
  }

  /**
   * Deterministic keyword classification: score each scenario by how many *distinctive* words of the
   * utterance belong only to it. Distinctiveness is derived from the catalog (a word appearing in one
   * scenario's title+description), so nothing hardcodes scenario ids. Returns the unique top scorer,
   * or null when the top is zero or tied (ambiguous) — the caller then asks to clarify.
   */
  private classify(text: string, scenarios: ScenarioCatalogEntry[]): ScenarioCatalogEntry | null {
    const df = new Map<string, Set<string>>(); // token → scenario ids that contain it
    for (const s of scenarios) {
      for (const tok of new Set(tokenize(`${s.title} ${s.description}`))) {
        (df.get(tok) ?? df.set(tok, new Set()).get(tok)!).add(s.id);
      }
    }

    const utter = new Set(tokenize(text));
    const scores = scenarios.map((s) => ({
      s,
      score: [...utter].filter((t) => df.get(t)?.size === 1 && df.get(t)!.has(s.id)).length,
    }));
    scores.sort((a, b) => b.score - a.score);

    const [top, runnerUp] = scores;
    if (!top || top.score === 0) return null;
    if (runnerUp && runnerUp.score === top.score) return null; // ambiguous tie
    return top.s;
  }

  private clarificationFor(scenarios: ScenarioCatalogEntry[]): string {
    return `Which operation do you mean? ${scenarios.map((s) => s.title).join(" · ")}`;
  }

  private proposeForSlot(
    slot: SlotDefinition,
    text: string,
    knownParties: { partyId: string; name: string }[],
  ): SlotProposal | null {
    switch (slot.type) {
      case SlotType.MONEY: {
        // First monetary-looking token, most-specific form first so a plain decimal (1500.00) is not
        // truncated by the thousands rule. Handles: 1.500,00 (pt-BR), 1,500.00 (US), 1500.00 / 1500,00,
        // and a bare 1500. (A bare integer inside an ISO date can still be a false positive — a known
        // stub limitation, harmless because the value is validated downstream and replaced in Phase 5.)
        const m = text.match(
          /(?:r\$|\$)?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2}|\d+)/i,
        );
        if (!m) return null;
        const value = this.normalizeMoney(m[1]);
        return value ? { key: slot.key, value, confidence: StubSlotExtractionAdapter.STRONG } : null;
      }
      case SlotType.DATE: {
        // ISO date only — the canonical shape the slot stores; other formats are left to be asked.
        const m = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        return m ? { key: slot.key, value: m[1], confidence: StubSlotExtractionAdapter.STRONG } : null;
      }
      case SlotType.CHOICE: {
        // Match any declared choice as a whole word, case-insensitively.
        const hit = (slot.choices ?? []).find((c) => new RegExp(`\\b${escapeRegex(c)}\\b`, "i").test(text));
        return hit ? { key: slot.key, value: hit, confidence: StubSlotExtractionAdapter.MEDIUM } : null;
      }
      case SlotType.PARTY: {
        // Ground a mention to a known party by name substring; without a directory, leave it unfilled.
        const hit = knownParties.find((p) => p.name && new RegExp(`\\b${escapeRegex(p.name)}\\b`, "i").test(text));
        return hit ? { key: slot.key, value: hit.partyId, confidence: StubSlotExtractionAdapter.MEDIUM } : null;
      }
      case SlotType.STRING:
      default:
        // Free text is too ambiguous to extract deterministically — leave it to be asked.
        return null;
    }
  }

  /** Normalize a matched money token to the slot's canonical "1234.56" form, or null if not sane. */
  private normalizeMoney(raw: string): string | null {
    let s = raw.trim();
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      // Whichever separator appears last is the decimal point; the other groups thousands.
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (hasComma) {
      // Lone comma → decimal separator: 1500,00 → 1500.00
      s = s.replace(",", ".");
    }
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    if (Number(s) <= 0) return null;
    return s;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase alphanumeric words of length ≥ 3 — short glue words never discriminate a scenario. */
function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
}
