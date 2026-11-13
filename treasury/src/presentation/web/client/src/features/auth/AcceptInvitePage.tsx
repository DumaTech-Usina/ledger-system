import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Banner } from "@/components/Banner";
import { AuthFrame } from "@/features/auth/AuthFrame";
import { authApi } from "@/features/auth/authApi";
import { acceptErrorMessage, passwordProblem, PASSWORD_MIN_LENGTH } from "@/features/auth/acceptInvite";

const PROBLEM_TEXT = {
  too_short: `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres. Uma frase serve bem.`,
  too_long: "Use no máximo 128 caracteres.",
  mismatch: "As duas senhas não são iguais.",
} as const;

/**
 * REQ-422: the person behind an invite link sets the password and, optionally, the name. Then they
 * log in like anyone else. No session exists yet, so this screen is outside the app shell.
 */
export function AcceptInvitePage({ token, onDone }: { token: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const problem = passwordProblem(password, confirmation);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problem) return;
    setError(null);
    setLoading(true);
    const { ok, data } = await authApi.acceptInvite(token, password, name);
    setLoading(false);
    if (ok) {
      onDone();
      return;
    }
    setError(acceptErrorMessage("error" in data ? data.error : undefined));
  }

  return (
    <AuthFrame title="Concluir o cadastro" subtitle="Defina a sua senha para entrar no Treasury.">
      {error && (
        <Banner variant="bad" role="alert" className="mb-4">
          {error}
        </Banner>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Nome (opcional)"
          name="name"
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Senha"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched && (problem === "too_short" || problem === "too_long") ? PROBLEM_TEXT[problem] : undefined}
        />
        <Input
          label="Repita a senha"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          error={touched && problem === "mismatch" ? PROBLEM_TEXT.mismatch : undefined}
        />
        <p className="text-[12.5px] text-muted">
          De {PASSWORD_MIN_LENGTH} a 128 caracteres, sem exigência de número ou símbolo.
        </p>
        <Button type="submit" loading={loading} className="mt-1 w-full">
          Criar acesso
        </Button>
      </form>
    </AuthFrame>
  );
}
