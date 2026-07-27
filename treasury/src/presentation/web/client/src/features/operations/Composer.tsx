import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { AttachmentMenu } from "@/features/operations/AttachmentMenu";
import type { SlotDefinition } from "@/types/operations";

export interface ComposerProps {
  slot: SlotDefinition;
  onAnswer: (value: string) => void;
  onAttach?: (file: File) => void;
  busy: boolean;
}

/** Keyed by `slot.key` from the parent so each new question starts with a clean field. */
export function Composer({ slot, onAnswer, onAttach, busy }: ComposerProps) {
  const [value, setValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputType = slot.type === "money" ? "number" : slot.type === "date" ? "date" : "text";

  const submit = () => {
    if (value.trim() === "" && slot.required) return;
    onAnswer(value);
    setValue("");
  };

  const openPicker = (accept: string) => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/40 bg-panel-solid/85 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-panel-solid/80">
      {onAttach && (
        <>
          <AttachmentMenu disabled={busy} onPick={openPicker} />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onAttach(file);
            }}
          />
        </>
      )}
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
