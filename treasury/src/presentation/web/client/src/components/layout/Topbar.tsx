import { Avatar } from "@/components/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface TopbarProps {
  title: string;
  userName: string;
  userRole: string;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function Topbar({ title, userName, userRole, onMenuClick, onSignOut }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-5 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="glass -ml-1 inline-flex size-10 items-center justify-center text-ink transition hover:bg-white/70 dark:hover:bg-white/10 md:hidden"
        >
          <svg viewBox="0 0 20 20" fill="none" className="size-[18px]">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="font-display text-2xl font-extrabold text-accent">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle className="glass size-10" />
        <div className="hidden items-center gap-2.5 rounded-full sm:flex">
          <Avatar name={userName} size="sm" className="border-2 border-accent-soft" />
          <div className="text-[13px] leading-tight">
            <span className="font-semibold text-ink">{userName}</span>
            <span className="text-muted"> · {userRole}</span>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="text-[13px] font-medium text-muted transition hover:text-accent"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
