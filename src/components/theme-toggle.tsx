"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ret-theme";

function saveTheme(dark: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Storage can be unavailable in private or sandboxed preview contexts.
    // The theme still remains active on the current page.
  }
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const syncFromDocument = () => setDark(document.documentElement.classList.contains("dark"));
    const frame = requestAnimationFrame(syncFromDocument);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const enabled = event.newValue === "dark";
      document.documentElement.classList.toggle("dark", enabled);
      setDark(enabled);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    // Read the DOM instead of relying on potentially stale hydrated state.
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    saveTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-ui bg-white/70 text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:bg-white/5 dark:text-slate-300"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
