import { env } from "../../config/env";

/**
 * TODO-03 (treasury/docs/requisitos_refinados.md §18): how long each request of the daily screens takes
 * against a running Treasury, read the way the screens read it (same routes, same default pages).
 * Run after `load:month` has filled a test book.
 *
 *   LOAD_SIMULATION=yes TREASURY_URL=http://localhost:4000 npm run load:measure -- [--runs=5]
 *
 * Logs in as the simulated CFO that `load:month` created, so lists such as the intents are read for
 * someone who did a month of work. Prints, per request, the median and the slowest of the runs, marking
 * what passes the 1-second budget.
 */

const BUDGET_MS = 1000;
const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 5);
const base = (process.env.TREASURY_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const EMAIL = "cfo@sim.test";
const PASSWORD = "senha-de-medicao-de-carga";

async function login(): Promise<string> {
  if (process.env.LOAD_SIMULATION !== "yes") throw new Error("Só contra um livro de teste: LOAD_SIMULATION=yes.");
  if (env.NODE_ENV === "production") throw new Error("Nunca em produção.");
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login como ${EMAIL} falhou (${res.status}): rode antes o load:month no mesmo ACCESS_DB_FILE`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function timed(cookie: string, path: string): Promise<{ ms: number; status: number; bytes: number; body: unknown }> {
  const start = performance.now();
  const res = await fetch(`${base}${path}`, { headers: { cookie } });
  const text = await res.text();
  const ms = performance.now() - start;
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { ms, status: res.status, bytes: text.length, body };
}

async function main(): Promise<void> {
  const cookie = await login();

  // The heaviest party and one policy, found the way a user would: from the screens' own lists.
  const party = process.env.MEASURE_PARTY ?? "sim-corretor-1";
  const signals = (await timed(cookie, "/api/signals?limit=20&filter=all")).body as { signals?: { recordId?: string }[] };
  const policy = process.env.MEASURE_POLICY ?? signals.signals?.[0]?.recordId ?? "";

  const screens: [string, string][] = [
    ["Painel · visão geral", "/api/dashboard/overview"],
    ["Painel · exposição", "/api/dashboard/exposure"],
    ["Painel · a pagar", "/api/dashboard/payables"],
    ["Posições · 1ª página", "/api/dashboard/positions?page=1&per_page=20"],
    ["Movimentos · 1ª página", "/api/dashboard/movements?page=1&per_page=20"],
    ["Intenções", "/api/intents"],
    ["Sinais · contagem no menu", "/api/signals/open-count"],
    ["Sinais · lista (esperando conferência)", "/api/signals?limit=20"],
    ["Sinais · lista (todos)", "/api/signals?limit=20&filter=all"],
    ["Sinais · situação da apólice", `/api/signals/policies/${encodeURIComponent(policy)}`],
    ["Partes · nomes", "/api/parties/names"],
    ["Partes · pendentes (aviso)", "/api/parties/pending"],
    ["Página da parte · cabeçalho e alertas", `/api/parties/${party}/page`],
    ["Página da parte · a Usina deve", `/api/parties/${party}/positions/usinaOwes?page=1&limit=20&sortBy=createdAt&sortOrder=DESC`],
    ["Página da parte · a parte deve", `/api/parties/${party}/positions/partyOwes?page=1&limit=20&sortBy=createdAt&sortOrder=DESC`],
    ["Página da parte · histórico", `/api/parties/${party}/history?page=1&limit=20&sortOrder=DESC&status=all`],
    ["Usuários", "/api/users"],
    ["Agenda a pagar · abertura", "/api/dashboard/agenda?limit=20"],
    ...(["overdue", "today", "next", "later", "undated"] as const).map(
      (w): [string, string] => [`Agenda a pagar · ${w}`, `/api/dashboard/agenda?window=${w}&limit=20`],
    ),
  ];

  console.log(`Medição: ${runs} leituras de cada tela em ${base} · parte ${party} · apólice ${policy || "(nenhuma)"}`);
  console.log(`${"tela".padEnd(42)} ${"mediana".padStart(9)} ${"pior".padStart(9)}  status  tamanho`);
  const slow: string[] = [];
  for (const [label, path] of screens) {
    const times: number[] = [];
    let status = 0;
    let bytes = 0;
    for (let i = 0; i < runs; i++) {
      const r = await timed(cookie, path);
      times.push(r.ms);
      status = r.status;
      bytes = r.bytes;
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const worst = times[times.length - 1];
    const mark = worst > BUDGET_MS || status >= 500 ? "  ← LENTO" : "";
    if (mark) slow.push(label);
    console.log(
      `${label.padEnd(42)} ${`${median.toFixed(0)} ms`.padStart(9)} ${`${worst.toFixed(0)} ms`.padStart(9)}  ${status}     ${(bytes / 1024).toFixed(0)} KB${mark}`,
    );
  }
  console.log(slow.length === 0 ? `Todas as telas dentro de ${BUDGET_MS} ms.` : `Acima de ${BUDGET_MS} ms: ${slow.join(", ")}.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
