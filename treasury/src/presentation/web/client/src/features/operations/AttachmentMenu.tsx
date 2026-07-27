import { useState } from "react";
import { Card } from "@/components/Card";
import { fileTypeIcons, paperclipIcon } from "@/features/operations/icons";

export interface FileTypeOption {
  id: "pdf" | "image" | "csv" | "xml";
  label: string;
  accept: string;
}

const FILE_TYPES: FileTypeOption[] = [
  { id: "pdf", label: "PDF", accept: "application/pdf" },
  { id: "image", label: "Imagem (PNG, JPG, WEBP)", accept: "image/png,image/jpeg,image/jpg,image/webp" },
  { id: "csv", label: "Planilha CSV", accept: "text/csv,application/vnd.ms-excel" },
  { id: "xml", label: "XML", accept: "text/xml,application/xml" },
];

export interface AttachmentMenuProps {
  disabled?: boolean;
  /** The chosen format's `accept` string — the caller sets it on the file input before opening it. */
  onPick: (accept: string) => void;
}

/** Paperclip button + "which file type" popover — asks the format before the file picker opens, per the guided-extraction flow. */
export function AttachmentMenu({ disabled, onPick }: AttachmentMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label="Anexar documento"
        aria-expanded={open}
        className="grid size-10 flex-shrink-0 place-items-center rounded-xl text-muted transition hover:bg-accent-soft hover:text-accent disabled:opacity-50 disabled:pointer-events-none"
      >
        {paperclipIcon}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <Card
            padding="none"
            className="absolute bottom-full left-0 z-40 mb-2 w-60 border-white/15 bg-panel-solid p-1.5 shadow-xl dark:border-white/10"
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Qual o tipo do arquivo?
            </p>
            {FILE_TYPES.map((ft) => (
              <button
                key={ft.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(ft.accept);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-accent-soft"
              >
                {fileTypeIcons[ft.id]}
                {ft.label}
              </button>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
