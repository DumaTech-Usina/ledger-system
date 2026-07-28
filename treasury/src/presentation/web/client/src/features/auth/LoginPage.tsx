import { useState, type FormEvent } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Banner } from "@/components/Banner";
import { ThemeToggle } from "@/components/ThemeToggle";

const LOGIN_ERROR = "Usuário ou senha inválidos.";

export interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<{ ok: boolean }>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await onLogin(username, password);
    setLoading(false);
    if (!result.ok) setError(LOGIN_ERROR);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <ThemeToggle className="glass fixed right-4 top-4 size-10" />

      <Card className="w-full max-w-sm" padding="lg">
        <div className="mb-7 flex flex-col items-center text-center">
          <span
            className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent shadow-[0_10px_24px_-8px_var(--color-accent)]"
            aria-hidden
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-6 text-accent-ink">
              <path d="M2 8 10 2.5 18 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 8h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M4.5 8v7M8 8v7M12 8v7M15.5 8v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M2.5 17.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <h1 className="font-display text-2xl font-bold text-ink">Entrar no Treasury</h1>
          <p className="mt-1.5 text-sm text-muted">Acesse com sua conta para continuar.</p>
        </div>

        {error && (
          <Banner variant="bad" role="alert" className="mb-4">
            {error}
          </Banner>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Usuário"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={loading} className="mt-1 w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
