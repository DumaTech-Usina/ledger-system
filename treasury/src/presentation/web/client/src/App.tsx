import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/Card";
import { OperationsPage } from "@/features/operations/OperationsPage";
import type { Role } from "@/types/auth";

const navItems = [
  { id: "operations", label: "Operações", icon: "operations" as const },
  { id: "dashboards", label: "Dashboards", icon: "dashboards" as const },
];

const pageTitles: Record<string, string> = {
  operations: "Operações",
  dashboards: "Dashboards",
};

const roleLabels: Record<Role, string> = {
  finance_manager: "Financeiro",
  viewer: "Somente leitura",
};

export function App() {
  const { status, user, login, logout, justLoggedIn, clearJustLoggedIn } = useAuth();
  const [activeNav, setActiveNav] = useState("operations");

  if (status === "checking") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-accent" aria-label="Carregando" />
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
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">Dashboards — em construção</h2>
          <p className="mt-1.5 text-sm text-muted">Esta página ainda não foi implementada; entra na próxima etapa.</p>
        </Card>
      )}
    </AppShell>
  );
}
