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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-panel backdrop-blur-xl",
          "transition-[transform,width] duration-300 ease-out",
          collapsed ? "md:w-[76px]" : "md:w-64",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex items-center gap-2.5 px-5 py-5", collapsed && "md:justify-center md:px-0")}>
          <span className="size-5 flex-shrink-0 rounded-[6px] bg-accent" aria-hidden />
          <span className={cn("font-display text-[17px] font-semibold text-ink", collapsed && "md:hidden")}>
            Treasury
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
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
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
                  collapsed && "md:justify-center md:px-0",
                  active
                    ? "bg-accent text-accent-ink shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]"
                    : "text-muted hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8",
                )}
              >
                <span className={cn("flex-shrink-0", !active && "opacity-80")}>{icons[item.icon]}</span>
                <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-line px-3 py-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "hidden w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted transition md:flex",
              "hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8",
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
          <div className={cn("px-3 pt-2 text-xs text-muted/80", collapsed && "md:hidden")}>
            User App · Ledger ecosystem
          </div>
        </div>
      </aside>
    </>
  );
}
