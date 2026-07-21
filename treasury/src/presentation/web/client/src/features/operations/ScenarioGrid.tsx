import { scenarioCopy } from "@/features/operations/copy";
import { defaultScenarioIcon, scenarioIcons } from "@/features/operations/icons";
import { cn } from "@/utils/cn";
import type { ScenarioSummary } from "@/types/operations";

export interface ScenarioGridProps {
  scenarios: ScenarioSummary[];
  onSelect: (scenario: ScenarioSummary) => void;
}

export function ScenarioGrid({ scenarios, onSelect }: ScenarioGridProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <p className="text-sm text-muted">Cada operação guia você pelas informações necessárias, passo a passo.</p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {scenarios.map((scenario, i) => {
          const copy = scenarioCopy[scenario.id];
          const isLastOdd = i === scenarios.length - 1 && scenarios.length % 2 === 1;
          return (
            <button
              key={scenario.id}
              onClick={() => onSelect(scenario)}
              className={cn(
                "group flex flex-col gap-2 rounded-2xl border border-white/40 bg-panel-solid/85 p-4 text-left shadow-sm backdrop-blur-md transition-all duration-300",
                "hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow dark:border-white/10 dark:bg-panel-solid/80",
                isLastOdd && "sm:col-span-2",
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
