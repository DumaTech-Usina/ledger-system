# ARCHITECTURE.md

How code is layered inside a `features/*` module. This is about structure, not visuals — see
`CLAUDE.md` for the design brief.

## The four layers

1. **API** (`xApi.ts`) — a thin, typed wrapper around `api/client.ts`'s `apiGet`/`apiPost`. One
   function per backend route, one file per feature. No state, no business rules — just "call this
   URL, get this shape back". Example: `features/dashboard/dashboardApi.ts`,
   `features/operations/operationsApi.ts`.

2. **Engine** (`xEngine.ts`) — **optional**. Pure, framework-agnostic functions: given the current
   facts, decide what should happen next. No React (`useState`/`useEffect`), no `fetch`, no
   `crypto.randomUUID()`-style hidden state feeding the decision itself. This is the layer that was
   missing for `operations` and is why new features there were hard to add — the decisions (which
   question to ask next, when to fall back to a direct answer, how to word a bubble) were buried
   inside a 400-line hook that also owned every `useState` and every network call.

   Only write one when a feature actually **has** decision logic worth isolating. `dashboard` and
   `auth` don't — they fetch, hold the result, and let the page format it for display. `operations`
   does, and now has [`conversationEngine.ts`](src/features/operations/conversationEngine.ts) as the
   worked example — read it side by side with the backend's own
   [`DialogEngine.ts`](../../../core/domain/services/DialogEngine.ts): same idea (pure, deterministic,
   "given state, decide the next step"), same reason it's separate (trivially testable without
   mounting anything — see `conversationEngine.test.ts`).

3. **Hook** (`useX.ts`) — owns the React state (`useState`/`useRef`) and every side effect (API
   calls, timers). Stays thin: it calls the API layer, asks the engine "what do I do with this
   result?" if one exists, and applies the answer (`setState`, push a message). It does **not**
   decide anything itself — if you find an `if` in a hook that isn't "should I call setState or
   not", that rule probably belongs in an engine function instead.

4. **Components** — render props, fire callbacks. No `fetch`, no business rules. Formatting for
   display (`formatMoney`, `formatDate` from `utils/format.ts`) happens here, not in the hook —
   that's presentation, not a decision about what happens next.

```
xApi.ts  →  xEngine.ts (optional, pure)  →  useX.ts (state + orchestration)  →  components (view)
```

## Adding a new feature

1. Start with `xApi.ts` — the routes you need, typed.
2. Ask: does this feature decide anything non-trivial ("what's the next question", "does this count
   as a match", "should this fall back to X")? If yes, write those as pure functions in `xEngine.ts`
   **first** — you can unit-test them before wiring up a single hook or component. If the feature is
   just "fetch, hold, render" (most dashboard-style features), skip this layer.
3. Write `useX.ts` to wire the above together. It should be short enough to read in one pass.
4. Build the components against the hook's return value.

## Testing

The client's test runner is `vitest` (`npm test` / `npm run test:watch`, config in
`vitest.config.ts`). Today it only needs `environment: "node"` — engine functions are pure TypeScript,
no DOM involved. If a component test is ever added, bring in `jsdom` and Testing Library then, not
before — don't pay for a browser environment that nothing uses yet.
