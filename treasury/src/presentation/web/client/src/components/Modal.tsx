import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Card } from "@/components/Card";
import { cn } from "@/utils/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
  /** Optional bar rendered below the header, above the scrollable content — e.g. category tabs. */
  tabs?: ReactNode;
}

export function Modal({ open, onClose, title, closeLabel, children, className, tabs }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        padding="none"
        className={cn("relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col bg-panel-solid", className)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
          >
            <X className="size-4" strokeWidth={1.6} />
          </button>
        </div>
        {tabs && <div className="border-b border-line px-5 py-3">{tabs}</div>}
        <div className="overflow-y-auto">{children}</div>
      </Card>
    </div>,
    document.body,
  );
}
