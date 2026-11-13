import type { Clock } from "../../core/application/ports/Clock";
import { AuthService } from "../../core/application/services/AuthService";
import { UserAdministrationService } from "../../core/application/services/UserAdministrationService";
import { UuidGenerator } from "../system/UuidGenerator";
import { SqliteUserRepository } from "../persistence/SqliteUserRepository";
import { SqliteInviteRepository } from "../persistence/SqliteInviteRepository";
import { SqliteAccessLog } from "../audit/SqliteAccessLog";
import { ScryptPasswordHasher } from "./ScryptPasswordHasher";
import { CryptoSecretGenerator } from "./CryptoSecretGenerator";
import { SqliteSessionStore } from "./SqliteSessionStore";
import { NoEmailAccessMailer } from "./NoEmailAccessMailer";

/**
 * The access module of §6, wired once for the server and the commands so both always read the same
 * file. Access is always durable, whatever the store mode of the operations: there is no default
 * user (REJ-407), so a store that forgets its users at restart would lock everybody out.
 */
export function accessModule(opts: { file: string; clock: Clock; publicBaseUrl: string }) {
  const hasher = new ScryptPasswordHasher();
  const users = new SqliteUserRepository(opts.file);
  const sessions = new SqliteSessionStore(opts.file, opts.clock);
  const auth = new AuthService(users, hasher, sessions, opts.clock);
  const userAdmin = new UserAdministrationService({
    users,
    invites: new SqliteInviteRepository(opts.file),
    sessions,
    log: new SqliteAccessLog(opts.file),
    hasher,
    secrets: new CryptoSecretGenerator(),
    mailer: new NoEmailAccessMailer(),
    clock: opts.clock,
    ids: new UuidGenerator(),
    publicBaseUrl: opts.publicBaseUrl,
  });
  return { users, auth, userAdmin };
}
