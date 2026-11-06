import { useState } from "react";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { scenarioCopy } from "@/features/operations/copy";
import { amountDigits, amountFromDigits, maskedAmount } from "@/utils/money";
import { cn } from "@/utils/cn";
import type { ScenarioSummary } from "@/types/operations";

export interface ComposerProps {
  placeholder?: string;
  /** A blank submission is blocked while a required question is open. */
  required?: boolean;
  onSend: (value: string) => void;
  busy: boolean;
  /** Picking-phase only: ranked scenario matches for the text typed so far, recomputed on every
   * keystroke (purely client-side — no backend round-trip). */
  suggest?: (query: string) => ScenarioSummary[];
  /** Jumps straight into a suggested scenario, bypassing free text entirely — the same effect as
   * tapping its ScenarioGrid card. */
  onPickSuggestion?: (scenario: ScenarioSummary) => void;
  /**
   * True while the open question is a date. The composer becomes the date field itself — the
   * calendar picker sits right where free text would otherwise go, rather than as a suggestion
   * floating above the input. `onSend` still answers it (a chosen day arrives as an ISO string,
   * same as any other slot answer), so nothing downstream needs to know the difference.
   */
  dateSlot?: boolean;
  /**
   * True while the open question is an amount. The field masks as it is typed, filling from the
   * cents (REQ-224), and what `onSend` receives is the plain decimal, so nothing the mask shows can
   * reach the Ledger (REQ-228).
   */
  moneySlot?: boolean;
}

/**
 * Always a single free-text field, whatever is being asked — the chat interprets what's typed
 * (via sendUtterance) instead of coercing the input to the open slot's type, so a value, a date,
 * or a whole sentence naming several fields at once all just work. Keyed by the parent (the open
 * slot's key, or a fixed key while picking) so each new question starts with a clean field.
 *
 * The exceptions are `dateSlot` and `moneySlot`. A date is answered by picking, so that turn swaps the
 * free-text field for `DatePicker`. An amount is answered through the mask, because a mask cannot
 * share a field with prose: "2000 em outubro" would have to be read either as R$ 20,00 or as a
 * sentence, and guessing changes the amount.
 */
export function Composer({
  placeholder,
  required,
  onSend,
  busy,
  suggest,
  onPickSuggestion,
  dateSlot,
  moneySlot,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const suggestions = suggest && value.trim() ? suggest(value) : [];

  const submit = () => {
    if (value.trim() === "" && required) return;
    onSend(moneySlot && value !== "" ? amountFromDigits(value) : value);
    setValue("");
  };

  const pick = (scenario: ScenarioSummary) => {
    onPickSuggestion?.(scenario);
    setValue("");
  };

  if (dateSlot) {
    return <DatePicker value="" onChange={onSend} disabled={busy} requireConfirm openDirection="up" showTodayShortcut />;
  }

  return (
    <div className="relative flex items-center gap-2 rounded-2xl border border-white/40 bg-panel-solid/85 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-panel-solid/80">
      {suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-2xl border border-line bg-panel-solid shadow-lg"
        >
          {suggestions.map((scenario, i) => (
            <button
              key={scenario.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => pick(scenario)}
              className={cn(
                "block w-full px-4 py-2.5 text-left text-sm text-ink transition hover:bg-accent-soft",
                i > 0 && "border-t border-line",
              )}
            >
              <span className="text-muted">Sugestão: </span>
              {scenarioCopy[scenario.id]?.title ?? scenario.title}
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        inputMode={moneySlot ? "numeric" : undefined}
        placeholder={moneySlot ? maskedAmount("") : placeholder}
        aria-label={placeholder}
        value={moneySlot && value !== "" ? maskedAmount(value) : value}
        disabled={busy}
        onChange={(e) => setValue(moneySlot ? amountDigits(e.target.value) : e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        className="h-10 flex-1 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-muted/70"
        autoFocus
      />
      <Button size="sm" disabled={busy} onClick={submit}>
        Enviar
      </Button>
    </div>
  );
}
