import { useEffect, useRef } from "react";

/**
 * Reads a screen again when `key` changes — but not on mount, where the screen's own effects already
 * read it. Used by the screens a conversation can be opened from (REQ-690): coming back from the
 * conversation shows the numbers it changed, without losing the window, filters or page.
 */
export function useReload(key: number | undefined, reload: () => void) {
  const first = useRef(true);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reloadRef.current();
  }, [key]);
}
