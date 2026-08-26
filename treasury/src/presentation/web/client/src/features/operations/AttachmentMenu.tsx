import { useState } from "react";
import { Card } from "@/components/Card";
import { extractionCopy } from "@/features/operations/copy";
import { fileTypeIcons, paperclipIcon } from "@/features/operations/icons";

export interface FileTypeOption {
  id: "pdf" | "image" | "csv" | "xml";
  accept: string;
}

const FILE_TYPES: FileTypeOption[] = [
  { id: "pdf", accept: "application/pdf" },
  { id: "image", accept: "image/png,image/jpeg,image/jpg,image/webp" },
  { id: "csv", accept: "text/csv,application/vnd.ms-excel" },
  { id: "xml", accept: "text/xml,application/xml" },
];

export interface AttachmentMenuProps {
  disabled?: boolean;
  /** The chosen format's `accept` string — the caller sets it on the file input before opening it. */
  onPick: (accept: string) => void;
}

/** Paperclip button + "which file type" popover — asks the format before the file picker opens, so
 * the browser's own picker is pre-filtered to that format instead of accepting anything. */
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
            className="absolute bottom-full left-0 z-40 mb-2 w-60 border-white/40 bg-panel-solid/95 p-1.5 shadow-xl backdrop-blur-md dark:border-white/10"
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {extractionCopy.pickType}
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
                {extractionCopy.fileTypes[ft.id]}
              </button>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
