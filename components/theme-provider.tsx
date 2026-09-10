"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useServerInsertedHTML } from "next/navigation";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: string) => void;
  themes: Theme[];
};

const STORAGE_KEY = "theme";
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=document.documentElement;if(t==="light"){d.classList.remove("dark");d.classList.add("light");d.style.colorScheme="light"}else{d.classList.add("dark");d.classList.remove("light");d.style.colorScheme="dark"}}catch(e){}})()`;
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
  });

  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const next = stored === "light" ? "light" : "dark";
      setThemeState(next);
      applyTheme(next);
    } catch {
      applyTheme("dark");
    }
  }, []);

  const setTheme = useCallback((next: string) => {
    const theme: Theme = next === "light" ? "light" : "dark";
    setThemeState(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore quota / private mode */
    }
    applyTheme(theme);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme: theme, setTheme, themes: ["light", "dark"] as Theme[] }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return (
    useContext(ThemeContext) ?? {
      theme: "dark" as const,
      resolvedTheme: "dark" as const,
      setTheme: () => {},
      themes: ["light", "dark"] as Theme[],
    }
  );
}
