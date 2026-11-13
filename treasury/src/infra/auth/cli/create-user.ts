import { env } from "../../../config/env";
import { SystemClock } from "../../system/SystemClock";
import { accessModule } from "../accessModule";
import { runCreateUser } from "../accessCommands";

/** Reads a line from the terminal without echoing it, so the password never shows nor stays in history. */
function askPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error("A senha é pedida num terminal interativo, sem eco (REQ-407)."));
      return;
    }
    process.stdout.write("Senha (12 a 128 caracteres): ");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let password = "";
    const onData = (char: string) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(password);
      } else if (char === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      } else if (char === "\u007f" || char === "\b") {
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };
    stdin.on("data", onData);
  });
}

/** `npm run user:create -- --email=… [--role=…] [--name=…]` (REQ-407, development only). */
runCreateUser(process.argv.slice(2), {
  userAdmin: accessModule({ file: env.ACCESS_DB_FILE, clock: new SystemClock(), publicBaseUrl: env.PUBLIC_BASE_URL }).userAdmin,
  production: env.NODE_ENV === "production",
  askPassword,
  print: (line) => console.log(line),
}).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
