import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { AcceptInvitePage } from "@/features/auth/AcceptInvitePage";
import { forgetInviteToken, inviteTokenFrom } from "@/features/auth/authApi";
import { UsersPage } from "@/features/users/UsersPage";
import { AgendaPage } from "@/features/agenda/AgendaPage";
import { agendaCopy } from "@/features/agenda/agendaCopy";
import { ReceivablesPage } from "@/features/receivables/ReceivablesPage";
import { receivablesCopy } from "@/features/receivables/receivablesCopy";
import { CashPage } from "@/features/cash/CashPage";
import { cashCopy } from "@/features/cash/cashCopy";
import { usersCopy } from "@/features/users/usersCopy";
import { AppShell } from "@/components/layout/AppShell";
import { OperationsPage } from "@/features/operations/OperationsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PositionsPage } from "@/features/dashboard/PositionsPage";
import { IntentsPage } from "@/features/intents/IntentsPage";
import { PartyViewPage } from "@/features/parties/PartyViewPage";
import { SignalsPage } from "@/features/signals/SignalsPage";
import { signalsCopy } from "@/features/signals/signalsCopy";
import { useOpenProposals } from "@/features/signals/useOpenProposals";
import { HealthSignalsPage } from "@/features/signals/HealthSignalsPage";
import { healthCopy } from "@/features/signals/healthCopy";
import { PendingIdentitiesBanner } from "@/features/parties/PendingIdentitiesBanner";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { usePendingIdentities } from "@/features/parties/usePendingIdentities";
import { useLanguage } from "@/i18n/i18n";
import type { Role } from "@/types/auth";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import type { ReturnTarget } from "@/features/operations/returnTarget";

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
  /**
   * REQ-690: the screen a conversation was opened from. That screen stays mounted (hidden) while the
   * conversation runs, so going back finds it as it was left; `originVersion` makes it read again.
   */
  const [returnTo, setReturnTo] = useState<ReturnTarget | null>(null);
  const [originVersion, setOriginVersion] = useState(0);
  /** Bumped by the notification's "Resolver": Partes opens at the identities to resolve (REQ-315). */
  const [focusPending, setFocusPending] = useState(0);
  /** REQ-696: a party's page asked for from another screen (an advance on the receivables agenda). */
  const [focusParty, setFocusParty] = useState<{ partyId: string; displayName: string; nonce: number } | null>(null);
  const { t, language } = useLanguage();
  const canCurate = user?.permissions.includes("party:curate") ?? false;
  const canManageUsers = user?.permissions.includes("user:manage") ?? false;
  const { pending, refresh: refreshPending } = usePendingIdentities(status === "authenticated");
  const { count: openProposals } = useOpenProposals(status === "authenticated", "insurance");
  const { count: openHealthProposals, refresh: refreshHealthProposals } = useOpenProposals(status === "authenticated", "health");

  const navItems = [
    { id: "operations", label: t.nav.operations, icon: "operations" as const },
    { id: "agenda", label: agendaCopy[language].nav, icon: "agenda" as const },
    { id: "receivables", label: receivablesCopy[language].nav, icon: "receivables" as const },
    { id: "cash", label: cashCopy[language].nav, icon: "cash" as const },
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
    {
      id: "health",
      label: healthCopy[language].nav,
      icon: "health" as const,
      badge: openHealthProposals,
      badgeLabel: healthCopy[language].openBadge(openHealthProposals),
    },
    ...(canManageUsers ? [{ id: "users", label: usersCopy[language].nav, icon: "users" as const }] : []),
  ];

  const pageTitles: Record<string, string> = {
    operations: t.nav.operations,
    dashboards: t.nav.dashboards,
    positions: t.nav.positions,
    intents: t.nav.intents,
    partyView: partiesCopy[language].viewHeading,
    signals: signalsCopy[language].nav,
    health: healthCopy[language].nav,
    users: usersCopy[language].nav,
    agenda: agendaCopy[language].nav,
    receivables: receivablesCopy[language].nav,
    cash: cashCopy[language].nav,
  };

  const roleLabels: Record<Role, string> = {
    admin: t.roles.admin,
    finance_manager: t.roles.finance_manager,
    viewer: t.roles.viewer,
  };

  /** Opens the conversation in Operations, remembering where to come back to (REQ-690). */
  const startFrom = (nav: string) => (intent: AdoptedIntent) => {
    setAdopted(intent);
    setReturnTo({ nav, intentId: intent.intentId });
    setActiveNav("operations");
  };

  const goBack = () => {
    if (!returnTo) return;
    setActiveNav(returnTo.nav);
    setReturnTo(null);
    setOriginVersion((v) => v + 1);
  };

  /** Choosing a screen from the menu is going somewhere else: the way back no longer applies. */
  const navigate = (nav: string) => {
    setReturnTo(null);
    // A party asked for from another screen (REQ-696) is not what the menu asks for.
    setFocusParty(null);
    setActiveNav(nav);
  };

  /** A screen a conversation can be opened from: shown when active, kept hidden while its conversation runs. */
  const kept = (nav: string) => activeNav === nav || (activeNav === "operations" && returnTo?.nav === nav);

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
      onNavSelect={navigate}
      pageTitle={pageTitles[activeNav]}
      userName={user.displayName}
      userRole={roleLabels[user.role]}
      onSignOut={logout}
      notice={
        <PendingIdentitiesBanner
          pending={pending}
          onResolve={
            canCurate
              ? () => {
                  // REQ-315: the identities are resolved in Partes, at the top of the list.
                  navigate("partyView");
                  setFocusPending((n) => n + 1);
                }
              : undefined
          }
        />
      }
    >
      {/* The screens a conversation can be opened from sit in fixed places, so hiding one while its
          conversation runs keeps it mounted — the same window, filters, page and ticks on return. */}
      {kept("agenda") && (
        <div hidden={activeNav !== "agenda"}>
          <AgendaPage
            canPay={user.permissions.includes("intent:submit")}
            onOperationStarted={startFrom("agenda")}
            reloadKey={originVersion}
          />
        </div>
      )}
      {kept("receivables") && (
        <div hidden={activeNav !== "receivables"}>
          <ReceivablesPage
            canReceive={user.permissions.includes("intent:submit")}
            onOperationStarted={startFrom("receivables")}
            reloadKey={originVersion}
            onOpenParty={(party) => {
              setFocusParty((current) => ({ ...party, nonce: (current?.nonce ?? 0) + 1 }));
              // One request at a time: an earlier "Resolver" must not send the page back to the list.
              setFocusPending(0);
              setReturnTo(null);
              setActiveNav("partyView");
            }}
          />
        </div>
      )}
      {kept("positions") && (
        <div hidden={activeNav !== "positions"}>
          <PositionsPage
            canRectify={user.permissions.includes("intent:submit")}
            onOperationStarted={startFrom("positions")}
            reloadKey={originVersion}
          />
        </div>
      )}
      {kept("partyView") && (
        <div hidden={activeNav !== "partyView"}>
          <PartyViewPage
            canCurate={canCurate}
            pending={pending}
            onChanged={refreshPending}
            focusPending={focusPending}
            canAct={user.permissions.includes("intent:submit")}
            onOperationStarted={startFrom("partyView")}
            reloadKey={originVersion}
            focusParty={focusParty}
          />
        </div>
      )}
      {activeNav === "agenda" || activeNav === "receivables" || activeNav === "positions" || activeNav === "partyView" ? null : activeNav === "cash" ? (
        <CashPage canWrite={user.permissions.includes("intent:submit")} />
      ) : activeNav === "users" && canManageUsers ? (
        <UsersPage me={user} onSelfChanged={refresh} />
      ) : activeNav === "signals" ? (
        <SignalsPage
          canCreate={user.permissions.includes("intent:create")}
          canSubmit={user.permissions.includes("intent:submit")}
          onReview={(intent) => {
            setAdopted(intent);
            setActiveNav("operations");
          }}
        />
      ) : activeNav === "health" ? (
        <HealthSignalsPage
          canCreate={user.permissions.includes("intent:create")}
          canSubmit={user.permissions.includes("intent:submit")}
          onChanged={refreshHealthProposals}
          onReview={(intent) => {
            setAdopted(intent);
            setActiveNav("operations");
          }}
        />
      ) : activeNav === "intents" ? (
        <IntentsPage />
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
          returnTo={returnTo}
          returnLabel={returnTo ? pageTitles[returnTo.nav] : undefined}
          onReturn={goBack}
          onReturnDiscarded={() => setReturnTo(null)}
        />
      ) : (
        <DashboardPage onNavigateToOperations={() => setActiveNav("operations")} onNavigate={navigate} />
      )}
    </AppShell>
  );
}
