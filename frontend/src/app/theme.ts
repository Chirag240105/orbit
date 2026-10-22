import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "orbit.theme";

const systemTheme = (): Theme => (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
const savedTheme = (): Theme | null => {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : null; } catch { return null; }
};

/** Current theme (saved choice, else the system setting) and a toggle that remembers the choice. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || savedTheme() || systemTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f2f8f7" : "#06121a");
  }, [theme]);
  // Follow the system setting until the user picks a theme explicitly.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const follow = () => { if (!savedTheme()) setTheme(mq.matches ? "light" : "dark"); };
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try { localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  return { theme, toggle };
}
