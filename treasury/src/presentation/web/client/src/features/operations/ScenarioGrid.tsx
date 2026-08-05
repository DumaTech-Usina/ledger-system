import { scenarioCopy } from "@/features/operations/copy";
import { defaultScenarioIcon, scenarioIcons } from "@/features/operations/icons";
import { cn } from "@/utils/cn";
import type { ScenarioSummary } from "@/types/operations";

export interface ScenarioGridProps {
  scenarios: ScenarioSummary[];
  onSelect: (scenario: ScenarioSummary) => void;
}

/**
 * Rectification is not offered here. The guided dialog would ask the operator to type the amount
 * and the position of the entry being corrected, while `POST /api/conversation/rectify` reads both
 * from the Ledger's own record — a correction that cannot disagree with what it corrects. The
 * action lives on the entry itself, in the position's lifecycle.
 *
 * This hides the card; it does not remove the path. An utterance the classifier still matches to
 * this scenario continues to work exactly as before.
 */
const HIDDEN_SCENARIOS = new Set(["register_rectification"]);

export function ScenarioGrid({ scenarios, onSelect }: ScenarioGridProps) {
  const offered = scenarios.filter((scenario) => !HIDDEN_SCENARIOS.has(scenario.id));

  return (
    <div className="flex min-h-full flex-col items-center gap-6 py-2 text-center">
      <p className="text-sm text-muted">Cada operação guia você pelas informações necessárias, passo a passo.</p>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {offered.map((scenario) => {
          const copy = scenarioCopy[scenario.id];
          return (
            <button
              key={scenario.id}
              onClick={() => onSelect(scenario)}
              className={cn(
                "group flex flex-col gap-2 rounded-2xl border border-white/40 bg-panel-solid/85 p-4 text-left shadow-sm backdrop-blur-md transition-all duration-300",
                "hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow dark:border-white/10 dark:bg-panel-solid/80",
              )}
            >
              <span className="text-accent">{scenarioIcons[scenario.id] ?? defaultScenarioIcon}</span>
              <span className="font-medium text-ink">{copy?.title ?? scenario.title}</span>
              <span className="text-xs text-muted">{copy?.description ?? scenario.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
