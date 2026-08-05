import { useEffect, useState } from "react";
import { operationsApi } from "@/features/operations/operationsApi";
import type { IntentSummary } from "@/types/operations";

/**
 * The user's own entries, newest first — the backend's order, kept as received. Fetch, hold,
 * render: no decision worth isolating, so no engine (see ARCHITECTURE.md).
 */
export function useIntents() {
  const [intents, setIntents] = useState<IntentSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    operationsApi
      .listIntents()
      .then(({ ok, data }) => {
        if (!cancelled) setIntents(ok ? data.intents : []);
      })
      .catch(() => {
        if (!cancelled) setIntents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { intents, loading: intents === null };
}
