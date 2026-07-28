import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { useLanguage } from "@/i18n/i18n";

export interface UserMenuProps {
  userName: string;
  userRole: string;
  onSignOut: () => void;
}

export function UserMenu({ userName, userRole, onSignOut }: UserMenuProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2.5">
      <div className="hidden text-right text-[13px] leading-tight sm:block">
        <span className="font-semibold text-ink">{userName}</span>
        <span className="block text-muted">{userRole}</span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.topbar.account}
        aria-expanded={open}
        className="relative inline-flex rounded-full"
      >
        <Avatar name={userName} size="sm" className="border-2 border-accent-soft" />
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full border border-panel-solid bg-panel-solid text-muted"
        >
          <svg viewBox="0 0 20 20" fill="none" className="size-2.5">
            <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
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
            className="absolute right-0 top-11 z-40 w-48 border-white/15 bg-panel-solid p-1.5 shadow-xl dark:border-white/10"
          >
            <div className="px-3 py-2 sm:hidden">
              <p className="text-[13px] font-semibold text-ink">{userName}</p>
              <p className="text-xs text-muted">{userRole}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2 rounded-xl bg-bad-soft px-3 py-2 text-left text-[13px] font-medium text-bad transition hover:bg-bad/20"
            >
              <svg viewBox="0 0 20 20" fill="none" className="size-4 flex-shrink-0">
                <path
                  d="M7.5 2.5H4.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12.5 6.5 16.5 10l-4 3.5M16 10H7.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t.topbar.signOut}
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
