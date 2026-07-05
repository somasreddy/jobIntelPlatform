"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, normalizeTheme } from "@/lib/theme";

interface ThemeContextValue {
  theme: string;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    const saved = normalizeTheme(localStorage.getItem("ji-theme"));
    setThemeState(saved);
    localStorage.setItem("ji-theme", saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const setTheme = (id: string) => {
    const nextTheme = normalizeTheme(id);
    setThemeState(nextTheme);
    localStorage.setItem("ji-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
