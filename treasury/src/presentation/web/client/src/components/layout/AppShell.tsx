import { type ReactNode, useEffect, useState } from "react";
import { Sidebar, type NavItem } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/utils/cn";

const COLLAPSE_KEY = "treasury.sidebarCollapsed";

export interface AppShellProps {
  navItems: NavItem[];
  activeNavId: string;
  onNavSelect: (id: string) => void;
  pageTitle: string;
  userName: string;
  userRole: string;
  onSignOut: () => void;
  children: ReactNode;
}

export function AppShell({
  navItems,
  activeNavId,
  onNavSelect,
  pageTitle,
  userName,
  userRole,
  onSignOut,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="relative min-h-screen">
      <Sidebar
        items={navItems}
        activeId={activeNavId}
        onSelect={onNavSelect}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin] duration-300 ease-out",
          collapsed ? "md:ml-[76px]" : "md:ml-64",
        )}
      >
        <Topbar
          title={pageTitle}
          userName={userName}
          userRole={userRole}
          onMenuClick={() => setMenuOpen(true)}
          onSignOut={onSignOut}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
