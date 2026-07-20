import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/utils/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8",
        className,
      )}
    >
      {isDark ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path d="M10 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-4a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM5 11H4a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2Zm10.66-5.66a1 1 0 0 1 0 1.42l-.71.7a1 1 0 1 1-1.41-1.4l.7-.72a1 1 0 0 1 1.42 0ZM6.46 14.24a1 1 0 0 1 0 1.42l-.71.7a1 1 0 1 1-1.41-1.41l.7-.71a1 1 0 0 1 1.42 0Zm9.24 1.42a1 1 0 0 1-1.42 0l-.7-.71a1 1 0 1 1 1.4-1.41l.72.7a1 1 0 0 1 0 1.42ZM5.75 5.75a1 1 0 0 1-1.42 0l-.7-.71a1 1 0 0 1 1.41-1.41l.71.7a1 1 0 0 1 0 1.42ZM10 16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path d="M17.293 13.293a8 8 0 0 1-10.586-10.586 8.001 8.001 0 1 0 10.586 10.586Z" />
        </svg>
      )}
    </button>
  );
}
