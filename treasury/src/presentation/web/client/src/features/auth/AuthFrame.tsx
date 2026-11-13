import type { ReactNode } from "react";
import { Warehouse } from "lucide-react";
import { Card } from "@/components/Card";
import { ThemeToggle } from "@/components/ThemeToggle";

/** The frame shared by the screens before a session exists: login and invite acceptance. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <ThemeToggle className="glass fixed right-4 top-4 size-10" />

      <Card className="w-full max-w-sm" padding="lg">
        <div className="mb-7 flex flex-col items-center text-center">
          <span
            className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent shadow-[0_10px_24px_-8px_var(--color-accent)]"
            aria-hidden
          >
            <Warehouse className="size-6 text-accent-ink" strokeWidth={1.6} />
          </span>
          <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}
