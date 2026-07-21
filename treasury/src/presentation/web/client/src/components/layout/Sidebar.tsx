import { type ReactElement } from "react";
import { cn } from "@/utils/cn";

export interface NavItem {
  id: string;
  label: string;
  icon: "operations" | "dashboards";
}

export interface SidebarProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const icons: Record<NavItem["icon"], ReactElement> = {
  operations: (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M10 2 18 10 10 18 2 10 10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  dashboards: (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <rect x="2.5" y="2.5" width="6" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="2.5" width="6" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="10.5" width="6" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="14.5" width="6" height="3" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

export function Sidebar({ items, activeId, onSelect, open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <>
      {open && (
        <button
          aria-label="Fechar menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/8 bg-canvas/70 p-4 backdrop-blur-2xl dark:border-white/5 dark:bg-canvas/60",
          "transition-[transform,width] duration-300 ease-out",
          collapsed ? "md:w-[76px]" : "md:w-64",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("mb-4 flex items-center gap-3 px-2 py-3", collapsed && "md:justify-center md:px-0")}>
          <span
            className="grid size-10 flex-shrink-0 place-items-center rounded-xl bg-accent shadow-[0_6px_16px_-4px_var(--color-accent)]"
            aria-hidden
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-5 text-accent-ink">
              <path d="M10 2 18 10 10 18 2 10 10 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <div className={cn(collapsed && "md:hidden")}>
            <div className="font-display text-lg font-bold leading-tight text-accent">Treasury</div>
            <div className="font-display text-[10px] font-bold uppercase tracking-widest text-muted">
              Ledger ecosystem
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-300",
                  collapsed && "md:justify-center md:px-0",
                  active
                    ? "bg-accent text-accent-ink shadow-lg shadow-accent/30"
                    : "text-muted hover:translate-x-1 hover:bg-accent-soft hover:text-accent",
                )}
              >
                <span className={cn("flex-shrink-0", !active && "opacity-80")}>{icons[item.icon]}</span>
                <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "hidden w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-medium text-muted transition-all duration-300 md:flex",
              "hover:bg-accent-soft hover:text-accent",
              collapsed && "md:justify-center md:px-0",
            )}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className={cn("size-4 flex-shrink-0 transition-transform duration-300", collapsed && "rotate-180")}
            >
              <path d="M12.5 4.5 6.5 10l6 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={cn(collapsed && "md:hidden")}>Recolher</span>
          </button>
        </div>
      </aside>
    </>
  );
}
