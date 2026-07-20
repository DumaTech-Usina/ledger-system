import { useState, type FormEvent } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
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
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-1/3 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/12 blur-[120px]"
      />
      <ThemeToggle className="fixed right-4 top-4" />

      <Card className="w-full max-w-sm" padding="lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 size-8 rounded-[8px] bg-accent" aria-hidden />
          <h1 className="font-display text-xl font-semibold text-ink">Entrar no Treasury</h1>
          <p className="mt-1 text-sm text-muted">Acesse com sua conta para continuar.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-bad-soft px-3 py-2.5 text-[13.5px] font-medium text-bad">
            {error}
          </div>
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
