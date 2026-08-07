import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { OperationsPage } from "@/features/operations/OperationsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PositionsPage } from "@/features/dashboard/PositionsPage";
import { IntentsPage } from "@/features/intents/IntentsPage";
import { useLanguage } from "@/i18n/i18n";
import type { Role } from "@/types/auth";
import type { AdoptedIntent } from "@/features/operations/useConversation";

export function App() {
  const { status, user, login, logout, justLoggedIn, clearJustLoggedIn } = useAuth();
  const [activeNav, setActiveNav] = useState("operations");
  /**
   * A conversation opened from a position, waiting to be adopted by the operations page.
   *
   * It lives here because it crosses two sections: it is created in Positions and consumed in
   * Operations. Cleared as soon as it is handed over, so returning to Operations later never
   * re-opens an operation the user already finished or abandoned.
   */
  const [adopted, setAdopted] = useState<AdoptedIntent | null>(null);
  const { t } = useLanguage();

  const navItems = [
    { id: "operations", label: t.nav.operations, icon: "operations" as const },
    { id: "dashboards", label: t.nav.dashboards, icon: "dashboards" as const },
    { id: "positions", label: t.nav.positions, icon: "positions" as const },
    { id: "intents", label: t.nav.intents, icon: "intents" as const },
  ];

  const pageTitles: Record<string, string> = {
    operations: t.nav.operations,
    dashboards: t.nav.dashboards,
    positions: t.nav.positions,
    intents: t.nav.intents,
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
      {activeNav === "intents" ? (
        <IntentsPage />
      ) : activeNav === "positions" ? (
        <PositionsPage
          canRectify={user.permissions.includes("intent:submit")}
          onOperationStarted={(intent) => {
            setAdopted(intent);
            setActiveNav("operations");
          }}
        />
      ) : activeNav === "operations" ? (
        // `justLoggedIn` flips true in the same render as `status`/`user` (login() batches all
        // three), so OperationsPage never sees a stale `showIntro=false` on its first render —
        // that one-render gap was what let the heading/chat lock in as "already visible" earlier.
        <OperationsPage
          user={user}
          showIntro={justLoggedIn}
          onIntroDone={clearJustLoggedIn}
          adopt={adopted}
          onAdopted={() => setAdopted(null)}
        />
      ) : (
        <DashboardPage onNavigateToOperations={() => setActiveNav("operations")} />
      )}
    </AppShell>
  );
}
