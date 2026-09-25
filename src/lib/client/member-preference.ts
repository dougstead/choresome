const KEY = "choresome:preferredMemberId";

export function getPreferredMemberId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setPreferredMemberId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private browsing, etc.) — preference just won't persist.
  }
}
