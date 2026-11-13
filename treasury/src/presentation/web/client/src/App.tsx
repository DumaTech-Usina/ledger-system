import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { AcceptInvitePage } from "@/features/auth/AcceptInvitePage";
import { forgetInviteToken, inviteTokenFrom } from "@/features/auth/authApi";
import { UsersPage } from "@/features/users/UsersPage";
import { AgendaPage } from "@/features/agenda/AgendaPage";
import { agendaCopy } from "@/features/agenda/agendaCopy";
import { usersCopy } from "@/features/users/usersCopy";
import { AppShell } from "@/components/layout/AppShell";
import { OperationsPage } from "@/features/operations/OperationsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PositionsPage } from "@/features/dashboard/PositionsPage";
import { IntentsPage } from "@/features/intents/IntentsPage";
import { PartiesPage } from "@/features/parties/PartiesPage";
import { PartyViewPage } from "@/features/parties/PartyViewPage";
import { SignalsPage } from "@/features/signals/SignalsPage";
import { signalsCopy } from "@/features/signals/signalsCopy";
import { useOpenProposals } from "@/features/signals/useOpenProposals";
import { PendingIdentitiesBanner } from "@/features/parties/PendingIdentitiesBanner";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { usePendingIdentities } from "@/features/parties/usePendingIdentities";
import { useLanguage } from "@/i18n/i18n";
import type { Role } from "@/types/auth";
import type { AdoptedIntent } from "@/features/operations/useConversation";

export function App() {
  const { status, user, login, logout, refresh, justLoggedIn, clearJustLoggedIn } = useAuth();
  // REQ-422: an invite link (`/?convite=<token>`) opens the acceptance screen, before any session.
  const [inviteToken, setInviteToken] = useState(() => inviteTokenFrom(window.location.search));
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("operations");
  /**
   * A conversation opened from a position, waiting to be adopted by the operations page.
   *
   * It lives here because it crosses two sections: it is created in Positions and consumed in
   * Operations. Cleared as soon as it is handed over, so returning to Operations later never
   * re-opens an operation the user already finished or abandoned.
   */
  const [adopted, setAdopted] = useState<AdoptedIntent | null>(null);
  const { t, language } = useLanguage();
  const canCurate = user?.permissions.includes("party:curate") ?? false;
  const canManageUsers = user?.permissions.includes("user:manage") ?? false;
  const { pending, refresh: refreshPending } = usePendingIdentities(status === "authenticated");
  const { count: openProposals } = useOpenProposals(status === "authenticated");

  const navItems = [
    { id: "operations", label: t.nav.operations, icon: "operations" as const },
    { id: "agenda", label: agendaCopy[language].nav, icon: "agenda" as const },
    { id: "dashboards", label: t.nav.dashboards, icon: "dashboards" as const },
    { id: "positions", label: t.nav.positions, icon: "positions" as const },
    { id: "intents", label: t.nav.intents, icon: "intents" as const },
    { id: "partyView", label: partiesCopy[language].viewHeading, icon: "partyView" as const },
    {
      id: "signals",
      label: signalsCopy[language].nav,
      icon: "signals" as const,
      badge: openProposals,
      badgeLabel: signalsCopy[language].openBadge(openProposals),
    },
    ...(canCurate ? [{ id: "parties", label: partiesCopy[language].heading, icon: "parties" as const }] : []),
    ...(canManageUsers ? [{ id: "users", label: usersCopy[language].nav, icon: "users" as const }] : []),
  ];

  const pageTitles: Record<string, string> = {
    operations: t.nav.operations,
    dashboards: t.nav.dashboards,
    positions: t.nav.positions,
    intents: t.nav.intents,
    partyView: partiesCopy[language].viewHeading,
    signals: signalsCopy[language].nav,
    parties: partiesCopy[language].heading,
    users: usersCopy[language].nav,
    agenda: agendaCopy[language].nav,
  };

  const roleLabels: Record<Role, string> = {
    admin: t.roles.admin,
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

  if (inviteToken) {
    return (
      <AcceptInvitePage
        token={inviteToken}
        onDone={() => {
          forgetInviteToken();
          setInviteToken(null);
          setLoginNotice("Cadastro concluído. Entre com o seu e-mail e a senha que você definiu.");
          if (status === "authenticated") void logout();
        }}
      />
    );
  }

  if (status === "anonymous" || !user) {
    return <LoginPage onLogin={login} notice={loginNotice} />;
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
      notice={
        <PendingIdentitiesBanner
          pending={pending}
          onResolve={canCurate ? () => setActiveNav("parties") : undefined}
        />
      }
    >
      {activeNav === "agenda" ? (
        <AgendaPage
          canPay={user.permissions.includes("intent:submit")}
          onOperationStarted={(intent) => {
            setAdopted(intent);
            setActiveNav("operations");
          }}
        />
      ) : activeNav === "users" && canManageUsers ? (
        <UsersPage me={user} onSelfChanged={refresh} />
      ) : activeNav === "parties" && canCurate ? (
        <PartiesPage pending={pending} onChanged={refreshPending} />
      ) : activeNav === "signals" ? (
        <SignalsPage
          canCreate={user.permissions.includes("intent:create")}
          canSubmit={user.permissions.includes("intent:submit")}
          onReview={(intent) => {
            setAdopted(intent);
            setActiveNav("operations");
          }}
        />
      ) : activeNav === "partyView" ? (
        <PartyViewPage />
      ) : activeNav === "intents" ? (
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
