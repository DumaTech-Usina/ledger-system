import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
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
          <ChevronDown className="size-2.5" strokeWidth={2} />
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
              <LogOut className="size-4 flex-shrink-0" strokeWidth={1.6} />
              {t.topbar.signOut}
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
