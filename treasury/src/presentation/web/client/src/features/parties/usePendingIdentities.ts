import { useCallback, useEffect, useState } from "react";
import { partiesApi, type PendingIdentity } from "@/features/parties/partiesApi";

const REFRESH_MS = 20_000;

/**
 * What the notification is about, kept current. It lives above the pages because it follows the user
 * across all of them. A failed read keeps what was last known: a blip must not make the warning vanish.
 */
export function usePendingIdentities(signedIn: boolean) {
  const [pending, setPending] = useState<PendingIdentity[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { ok, data } = await partiesApi.pending();
      if (ok) setPending(data.pending);
    } catch {
      /* keep what was last known */
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setPending([]);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [signedIn, refresh]);

  return { pending, refresh };
}
