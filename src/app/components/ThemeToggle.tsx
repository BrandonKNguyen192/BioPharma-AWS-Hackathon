"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "cleartrial-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light",
  );

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={toggleTheme}
      className={`ct-theme-toggle inline-flex items-center justify-center gap-2 ${compact ? "h-11 w-11 rounded-full" : "h-10 rounded-full px-3.5 text-xs font-medium"}`}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      {isLight ? (
        <MoonStar className="h-3.5 w-3.5" />
      ) : (
        <SunMedium className="h-3.5 w-3.5" />
      )}
      {!compact && <span>{isLight ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
