import { useState } from "react";
import { Button } from "@/components/Button";

export interface ComposerProps {
  placeholder?: string;
  /** A blank submission is blocked while a required question is open. */
  required?: boolean;
  onSend: (value: string) => void;
  busy: boolean;
}

/**
 * Always a single free-text field, whatever is being asked — the chat interprets what's typed
 * (via sendUtterance) instead of coercing the input to the open slot's type, so a value, a date,
 * or a whole sentence naming several fields at once all just work. Keyed by the parent (the open
 * slot's key, or a fixed key while picking) so each new question starts with a clean field.
 */
export function Composer({ placeholder, required, onSend, busy }: ComposerProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim() === "" && required) return;
    onSend(value);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/40 bg-panel-solid/85 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-panel-solid/80">
      <input
        type="text"
        placeholder={placeholder}
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
