import { Menu } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/layout/UserMenu";
import { useLanguage } from "@/i18n/i18n";

export interface TopbarProps {
  title: string;
  userName: string;
  userRole: string;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function Topbar({ title, userName, userRole, onMenuClick, onSignOut }: TopbarProps) {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-5 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label={t.topbar.openMenu}
          className="glass -ml-1 inline-flex size-10 items-center justify-center text-ink transition hover:bg-white/70 dark:hover:bg-white/10 md:hidden"
        >
          <Menu className="size-[18px]" strokeWidth={1.6} />
        </button>
        <h1 className="font-display text-2xl font-extrabold text-accent">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSwitcher className="glass size-10" />
        <ThemeToggle className="glass size-10" />
        <UserMenu userName={userName} userRole={userRole} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
