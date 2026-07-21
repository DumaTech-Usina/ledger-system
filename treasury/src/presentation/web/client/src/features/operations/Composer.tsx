import { useState } from "react";
import { Button } from "@/components/Button";
import type { SlotDefinition } from "@/types/operations";

export interface ComposerProps {
  slot: SlotDefinition;
  onAnswer: (value: string) => void;
  busy: boolean;
}

/** Keyed by `slot.key` from the parent so each new question starts with a clean field. */
export function Composer({ slot, onAnswer, busy }: ComposerProps) {
  const [value, setValue] = useState("");

  if (slot.type === "choice" && slot.choices) {
    return (
      <div className="flex flex-wrap gap-2">
        {slot.choices.map((choice) => (
          <Button key={choice} variant="ghost" size="sm" disabled={busy} onClick={() => onAnswer(choice)}>
            {choice}
          </Button>
        ))}
      </div>
    );
  }

  const inputType = slot.type === "money" ? "number" : slot.type === "date" ? "date" : "text";

  const submit = () => {
    if (value.trim() === "" && slot.required) return;
    onAnswer(value);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/40 bg-panel-solid/85 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-panel-solid/80">
      <input
        type={inputType}
        step={slot.type === "money" ? "0.01" : undefined}
        placeholder={slot.type === "money" ? "0,00" : slot.required ? undefined : "Opcional"}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
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
