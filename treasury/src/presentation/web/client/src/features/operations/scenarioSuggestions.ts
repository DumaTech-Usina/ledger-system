import { scenarioCopy } from "@/features/operations/copy";
import type { ScenarioSummary } from "@/types/operations";

/** Lowercases and strips diacritics so "comissao" and "comissão" match the same way. */
const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Live, client-only suggestions for the picking-phase composer — the scenario catalog (with its
 * pt-BR titles) is already loaded, so this needs no backend round-trip and can run on every
 * keystroke. Ranks a title that starts with the query above one where some word starts with it,
 * above one that merely contains it somewhere; ties keep the catalog's own order.
 */
export function suggestScenarios(query: string, scenarios: ScenarioSummary[], limit = 3): ScenarioSummary[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const scored = scenarios
    .map((scenario) => {
      const title = normalize(scenarioCopy[scenario.id]?.title ?? scenario.title);
      let score = 0;
      if (title.startsWith(q)) score = 3;
      else if (title.split(/\s+/).some((word) => word.startsWith(q))) score = 2;
      else if (title.includes(q)) score = 1;
      return { scenario, score };
    })
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((entry) => entry.scenario);
}
