import { env } from "../../../config/env";
import { SystemClock } from "../../system/SystemClock";
import { accessModule } from "../accessModule";
import { runFirstAdmin } from "../accessCommands";

/** `npm run user:first-admin -- <e-mail>` (REQ-405). */
runFirstAdmin(process.argv.slice(2), {
  userAdmin: accessModule({ file: env.ACCESS_DB_FILE, clock: new SystemClock(), publicBaseUrl: env.PUBLIC_BASE_URL }).userAdmin,
  print: (line) => console.log(line),
}).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
