import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
const KEY = "orbit-theme";

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Applies the theme to <html data-theme>; "system" removes the attribute so the CSS follows prefers-color-scheme. index.html applies the stored choice before first paint. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(read);
  useEffect(() => {
    const root = document.documentElement;
    if (pref === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = pref;
    try {
      if (pref === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch { /* storage blocked: the choice lasts for this page only */ }
  }, [pref]);
  return [pref, setPref] as const;
}
