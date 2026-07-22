import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { OperationsPage } from "@/features/operations/OperationsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { useLanguage } from "@/i18n/i18n";
import type { Role } from "@/types/auth";

export function App() {
  const { status, user, login, logout, justLoggedIn, clearJustLoggedIn } = useAuth();
  const [activeNav, setActiveNav] = useState("operations");
  const { t } = useLanguage();

  const navItems = [
    { id: "operations", label: t.nav.operations, icon: "operations" as const },
    { id: "dashboards", label: t.nav.dashboards, icon: "dashboards" as const },
  ];

  const pageTitles: Record<string, string> = {
    operations: t.nav.operations,
    dashboards: t.nav.dashboards,
  };

  const roleLabels: Record<Role, string> = {
    finance_manager: t.roles.finance_manager,
    viewer: t.roles.viewer,
  };

  if (status === "checking") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-accent" aria-label={t.common.loading} />
      </div>
    );
  }

  if (status === "anonymous" || !user) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <AppShell
      navItems={navItems}
      activeNavId={activeNav}
      onNavSelect={setActiveNav}
      pageTitle={pageTitles[activeNav]}
      userName={user.displayName}
      userRole={roleLabels[user.role]}
      onSignOut={logout}
    >
      {activeNav === "operations" ? (
        // `justLoggedIn` flips true in the same render as `status`/`user` (login() batches all
        // three), so OperationsPage never sees a stale `showIntro=false` on its first render —
        // that one-render gap was what let the heading/chat lock in as "already visible" earlier.
        <OperationsPage user={user} showIntro={justLoggedIn} onIntroDone={clearJustLoggedIn} />
      ) : (
        <DashboardPage onNavigateToOperations={() => setActiveNav("operations")} />
      )}
    </AppShell>
  );
}
