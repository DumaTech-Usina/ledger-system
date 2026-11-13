import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Banner } from "@/components/Banner";
import { AuthFrame } from "@/features/auth/AuthFrame";

/** REQ-413: the same message for an unknown e-mail, a wrong password, a deactivated or suspended login. */
const LOGIN_ERROR = "E-mail ou senha inválidos.";

export interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ ok: boolean }>;
  /** Shown above the form, e.g. right after an invite was accepted. */
  notice?: string | null;
}

export function LoginPage({ onLogin, notice }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await onLogin(email, password);
    setLoading(false);
    if (!result.ok) setError(LOGIN_ERROR);
  }

  return (
    <AuthFrame title="Entrar no Treasury" subtitle="Acesse com seu e-mail para continuar.">
      {notice && !error && (
        <Banner variant="ok" role="status" className="mb-4">
          {notice}
        </Banner>
      )}
      {error && (
        <Banner variant="bad" role="alert" className="mb-4">
          {error}
        </Banner>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      <p className="mt-5 text-center text-[12.5px] text-muted">
        Esqueceu a senha? Peça ao administrador um novo convite.
      </p>
    </AuthFrame>
  );
}
