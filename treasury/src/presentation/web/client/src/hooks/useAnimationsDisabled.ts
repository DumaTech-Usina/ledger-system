import { useSyncExternalStore } from "react";

/** A small localStorage-backed on/off switch, reactive across every component reading it. */
function createToggle(key: string) {
  const listeners = new Set<() => void>();

  function read(): boolean {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  let cached = read();

  function getSnapshot(): boolean {
    return cached;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function set(next: boolean): void {
    cached = next;
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Best-effort persistence — an unavailable localStorage never blocks the in-memory toggle.
    }
    listeners.forEach((listener) => listener());
  }

  function useValue(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot);
  }

  return { useValue, set };
}

// Two independent preferences — a user may want the ambient video off but the typing reveal on,
// or vice versa, so each gets its own switch instead of sharing one flag.
const videoAnimation = createToggle("treasury.hideChatAnimation");
const typingAnimation = createToggle("treasury.hideTypingAnimation");

/** Whether the ambient chat video (dark theme only) is turned off. */
export const useVideoAnimationDisabled = videoAnimation.useValue;
export const setVideoAnimationDisabled = videoAnimation.set;

/** Whether the chat's typing reveal (character-by-character + inter-message pacing) is turned off. */
export const useTypingAnimationDisabled = typingAnimation.useValue;
export const setTypingAnimationDisabled = typingAnimation.set;
