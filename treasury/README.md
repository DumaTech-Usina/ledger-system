# Treasury (User App)

A guided, conversational capture app for the Ledger. A user describes a financial operation; Treasury
runs deterministic slot filling, builds a Ledger-compatible **Candidate**, and submits it. The Ledger
stays the sole authority over validation — Treasury only proposes and interprets the outcome.

## Run it (dev)

```bash
cd treasury
npm install
npm run dev            # http://localhost:4000
```

No database and no Ledger service are needed in dev: the defaults are `LEDGER_MODE=simulate` (an
in-memory fake Ledger for both submit and dashboards) and `EXTRACTION_MODE=stub` (a deterministic
regex/keyword extractor — no LLM). Seed logins:

| User | Password | Role |
| --- | --- | --- |
| `cfo` | `treasury` | finance manager (can submit) |
| `viewer` | `viewer` | read-only |

Relevant env (`src/config/env.ts`): `PORT` (4000), `LEDGER_MODE` (`simulate` \| `stub` \| `live`),
`EXTRACTION_MODE` (`stub`), `LEDGER_API_URL`, `USINA_PARTY_ID`.

> **Note on `simulate`:** the in-memory fake Ledger accepts almost everything (it does **not** run the
> real invariants). To exercise real economic rejection, the correction loop, and lineage validation,
> run with `LEDGER_MODE=live` against a running Ledger.

---

## Conversation API

Base path `/api/conversation` (session-cookie auth; log in via `POST /api/auth/login`).

| Method & path | Purpose |
| --- | --- |
| `GET /scenarios` | list operations (`{ id, title, description }`) |
| `POST /start` `{ scenarioId }` | start a guided intent |
| `POST /:id/answer` `{ key, value }` | answer one slot (guided) |
| **`POST /interpret`** `{ utterance }` | **natural-language entry — classify + pre-fill (below)** |
| `POST /:id/interpret` `{ utterance }` | continue an existing intent from free text |
| `GET /:id/preview` | the exact Candidate that would be submitted |
| `POST /:id/submit` | submit to the Ledger |
| `GET /api/intents/:id` | intent status + audit history |

---

## Connecting the frontend to `/interpret`

`/interpret` is the free-text entry point. It asks the extraction adapter (behind
`SlotExtractionPort`) to **classify** the utterance into a scenario and **propose** slot values; the
deterministic pipeline then records the confident ones. It never bypasses validation — extraction
only proposes, the guided engine merges, and the Ledger disposes.

The extraction adapter is a swappable implementation detail: replacing the stub with an LLM adapter
changes nothing about this request/response contract.

### Request

```jsonc
POST /api/conversation/interpret
{ "utterance": "paguei a folha dos empregados 1500,00 em 2026-07-09" }
```

### Response — two outcomes

**1) Classified** — an intent is created and pre-filled; continue the guided dialog from `state`:

```jsonc
{
  "intentId": "20e0…",          // created for this utterance
  "scenarioId": "register_payroll",
  "state": {                     // the next dialog step
    "kind": "question",          // "question" | "ready"
    "slot": { "key": "payee", "type": "party", "prompt": "…", "required": true },
    "answered": 2, "total": 5
  },
  "accepted": ["amount", "occurredAt"], // slots extracted with enough confidence and recorded
  "rejected": [],                        // proposals that failed validation
  "skipped": [],                         // slots already filled
  "lowConfidence": []                    // proposals held back below the threshold
}
```

**2) Ambiguous / not understood** — nothing is created; fall back to the operation menu:

```jsonc
{ "clarification": "Which operation do you mean? …", "accepted": [], "rejected": [], "skipped": [], "lowConfidence": [] }
```

Branch on `scenarioId && intentId`: present ⇒ enter the conversation; absent ⇒ show the picker.
When `state.kind === "ready"`, all required slots were filled in one shot — go straight to preview.

### Frontend wiring (the actual client, `src/presentation/web/client/index.html`)

```js
// api call — the only line that would change for an LLM adapter is none: same endpoint.
interpret: (utterance) => post("/api/conversation/interpret", { utterance }),

async function interpretEntry(raw) {
  const utterance = (raw || "").trim();
  if (!utterance) return;
  const { ok, data } = await api.interpret(utterance);

  // Ambiguous → keep the operation menu as the fallback; create nothing.
  if (!ok || !data.scenarioId || !data.intentId) {
    showHint(T.t("ui.interpret_ambiguous"));
    return;
  }

  // Classified → jump into the guided flow with whatever was pre-filled.
  intentId = data.intentId;
  openWorkspace(data.scenarioId);          // reveal the chat, bound to the scenario
  say("me", utterance);
  say("bot", T.t("ui.interpret_understood", { op: T.scenarioTitle(data.scenarioId), n: data.accepted.length }));
  renderState(data.state);                 // ask the next missing slot (or go to preview if ready)
}
```

The classified path reuses the **same** `renderState` / `answer` loop as the guided picker — free
text is just an alternative way to *start* and *pre-fill*; everything after is identical.

### Try it with curl

```bash
curl -s -c /tmp/c -X POST localhost:4000/api/auth/login \
  -H 'content-type: application/json' -d '{"username":"cfo","password":"treasury"}'

curl -s -b /tmp/c -X POST localhost:4000/api/conversation/interpret \
  -H 'content-type: application/json' \
  -d '{"utterance":"conceder um adiantamento de 2000,00 em 2026-07-10"}'
# → scenarioId: register_advance, accepted: ["amount","occurredAt"], next slot: payee
```

### What the deterministic extractor recognizes today

- **Classification** — keyword scoring over each scenario's localized `keywords` (pt-BR and English),
  accent-insensitive. Distinctive words classify (e.g. *folha*, *multa*, *adiantamento*, *renúncia*);
  a shared noun with no distinguishing verb stays ambiguous → clarification (by design).
- **Slot extraction** — money (pt-BR and US formats) and ISO dates are extracted from free text;
  parties and event references are asked explicitly unless grounded by a directory. Everything the
  extractor does not fill is simply asked by the guided dialog.

An LLM adapter (a future `EXTRACTION_MODE`) would improve recognition of free-form, multilingual
input **without touching this contract or the downstream flow.**
