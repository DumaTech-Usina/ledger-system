import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { PositionLifecycle } from "@/types/dashboard";

/**
 * The three answers the Ledger can give about one object, kept distinct on purpose.
 *
 * `unknown` (404) is not `unavailable` (the read failed) and neither is an empty history: the first
 * says the Ledger holds no such object, the second says we could not ask. Collapsing them would let
 * a transport failure read as "nothing ever happened here".
 */
export type ObjectLifecycleState =
  | { kind: "loading" }
  | { kind: "found"; lifecycle: PositionLifecycle }
  | { kind: "unknown" }
  | { kind: "unavailable" };

/**
 * Fetches one object's lifecycle. Pass null to hold off (e.g. the tab isn't open yet). `reload`
 * re-reads it — used after a rectification, so the retraction it caused is read from the Ledger
 * rather than guessed at locally.
 */
export function useObjectLifecycle(objectId: string | null): ObjectLifecycleState & { reload: () => void } {
  const [state, setState] = useState<ObjectLifecycleState>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (objectId === null) return;
    let cancelled = false;
    setState({ kind: "loading" });

    dashboardApi
      .objectLifecycle(objectId)
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        if (ok) {
          setState({ kind: "found", lifecycle: data as PositionLifecycle });
          return;
        }
        setState({ kind: status === 404 ? "unknown" : "unavailable" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [objectId, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
