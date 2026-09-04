import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "dcc-theme";
const CHANGE_EVENT = "dcc-theme-change";
const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
let inMemoryTheme: Theme | null = null;

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : inMemoryTheme;
  } catch {
    return inMemoryTheme;
  }
}

function getThemeSnapshot(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  return window.matchMedia(DARK_MODE_QUERY).matches ? "dark" : "light";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DARK_MODE_QUERY);

  function handleSystemThemeChange() {
    if (!readStoredTheme()) onStoreChange();
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      inMemoryTheme = event.newValue === "light" || event.newValue === "dark"
        ? event.newValue
        : null;
      onStoreChange();
    }
  }

  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorageChange);
  mediaQuery.addEventListener("change", handleSystemThemeChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorageChange);
    mediaQuery.removeEventListener("change", handleSystemThemeChange);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
}

export function setTheme(theme: Theme) {
  inMemoryTheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The active document still receives the preference when storage is unavailable.
  }

  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
