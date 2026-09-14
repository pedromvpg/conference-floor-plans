"use client";

import { createContext, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useServerInsertedHTML } from "next/navigation";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: string) => void;
  themes: Theme[];
};

const STORAGE_KEY = "theme";
const THEME_EVENT = "conference-floor-plans-theme";
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=document.documentElement;if(t==="light"){d.classList.remove("dark");d.classList.add("light");d.style.colorScheme="light"}else{d.classList.add("dark");d.classList.remove("light");d.style.colorScheme="dark"}}catch(e){}})()`;
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

function writeTheme(next: string) {
  const theme: Theme = next === "light" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
  });

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = useCallback((next: string) => writeTheme(next), []);
  const value = useMemo(
    () => ({ theme, resolvedTheme: theme, setTheme, themes: ["light", "dark"] as Theme[] }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = useCallback((next: string) => writeTheme(next), []);
  return {
    theme,
    resolvedTheme: theme,
    setTheme,
    themes: ["light", "dark"] as Theme[],
  };
}
