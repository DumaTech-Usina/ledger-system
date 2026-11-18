import { useCallback, useEffect, useState } from "react";
import { signalsApi, type SignalSystem } from "./signalsApi";

const REFRESH_MS = 20_000;

/**
 * How many proposals from one external system still wait for someone (round 15, §4.7). Same mechanism as
 * the provisional-identity notice: re-read every 20 s while signed in; a failed read keeps the last
 * known number, so a blip never makes the warning vanish.
 */
export function useOpenProposals(signedIn: boolean, system: SignalSystem) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { ok, data } = await signalsApi.openCount(system);
      if (!ok || !("count" in data)) return;
      setCount(data.count);
    } catch {
      /* keep what was last known */
    }
  }, [system]);

  useEffect(() => {
    if (!signedIn) {
      setCount(0);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [signedIn, refresh]);

  return { count, refresh };
}
