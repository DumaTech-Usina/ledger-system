import { Role, isRole } from "../../core/domain/enums/Role";
import type { UserAdministrationService } from "../../core/application/services/UserAdministrationService";

/**
 * The two server commands of §6.1, as functions so they can be tested without a terminal. The entry
 * points in `cli/` only read the environment and the terminal, then call these.
 */

interface CommandIo {
  userAdmin: UserAdministrationService;
  print: (line: string) => void;
}

/** REQ-405: `first-admin <e-mail>` prints an administrator invite. It takes no password and creates no user. */
export async function runFirstAdmin(args: string[], io: CommandIo): Promise<void> {
  const email = args.find((a) => !a.startsWith("--"));
  if (!email) throw new Error("Uso: first-admin <e-mail>");
  const { link, expiresAt } = await io.userAdmin.issueFirstAdminInvite(email);
  io.print("Convite de administrador emitido. Abra o link abaixo para definir a senha:");
  io.print(link);
  io.print(`Válido até ${expiresAt}. O link é de uso único; não o compartilhe.`);
}

/**
 * REQ-407: `create-user --email=… [--role=admin|finance_manager|viewer] [--name=…]`, development only.
 * The password is asked for without echo, never taken as an argument, so it stays out of the shell
 * history. In production the command refuses before asking anything.
 */
export async function runCreateUser(
  args: string[],
  io: CommandIo & { production: boolean; askPassword: () => Promise<string> },
): Promise<void> {
  if (io.production) {
    throw new Error("Em produção, todo usuário entra por convite (REQ-407). Use o Treasury para convidar.");
  }
  const flags = Object.fromEntries(
    args.filter((a) => a.startsWith("--")).map((a) => {
      const [key, ...rest] = a.slice(2).split("=");
      return [key, rest.join("=")];
    }),
  );
  if ("password" in flags) {
    throw new Error("A senha nunca é um argumento do comando; ela é pedida no prompt, sem eco (REQ-407).");
  }
  if (!flags.email) throw new Error("Uso: create-user --email=<e-mail> [--role=admin|finance_manager|viewer] [--name=<nome>]");
  const role = flags.role ? (flags.role === "user" ? Role.FINANCE_MANAGER : flags.role) : Role.FINANCE_MANAGER;
  if (!isRole(role)) throw new Error(`Papel desconhecido: ${flags.role}. Use admin, finance_manager ou viewer.`);

  const password = await io.askPassword();
  const user = await io.userAdmin.createUserByCommand(flags.email, password, role, flags.name || null);
  io.print(`Usuário criado: ${user.email} (${user.role}).`);
}
