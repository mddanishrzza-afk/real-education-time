"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Smartphone, X } from "lucide-react";

const DISMISS_KEY = "ret-install-banner-dismissed";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const noopSubscribe = () => () => undefined;
const readDismissed = () => window.localStorage.getItem(DISMISS_KEY) === "1";
const readStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const readIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

/**
 * Honest install helper for Android/desktop Chrome (real beforeinstallprompt) and iOS Safari
 * (manual steps, because Safari exposes no programmatic install). Hidden once the app is already
 * installed/standalone or the student has dismissed it.
 */
export function InstallAppBanner() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);
  const standalone = useSyncExternalStore(noopSubscribe, readStandalone, () => false);
  const isIos = useSyncExternalStore(noopSubscribe, readIos, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      window.localStorage.setItem(DISMISS_KEY, "1");
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || standalone) return null;

  async function install() {
    if (!prompt) {
      setShowSteps(true);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(DISMISS_KEY, "1");
      emit();
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ui bg-[var(--surface-soft)] px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Smartphone size={17} /></span>
      <p className="flex-1 text-xs font-bold leading-5">
        Install the RET Learn app on this phone — it opens full screen, works on slow networks and uses the same account.
      </p>
      <button type="button" onClick={install} className="focus-ring rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-black text-white dark:bg-brand-600">
        {prompt ? "Install app" : "How to install"}
      </button>
      <button
        type="button"
        aria-label="Dismiss install banner"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, "1");
          emit();
        }}
        className="focus-ring rounded-lg p-2 text-muted"
      >
        <X size={16} />
      </button>
      {showSteps && !prompt ? (
        <p className="basis-full text-[11px] leading-5 text-muted">
          {isIos
            ? "On iPhone: open this site in Safari → Share button → “Add to Home Screen”."
            : "On Android Chrome: open the browser menu (⋮) → “Install app” or “Add to Home screen”."}{" "}
          The installed app uses the same account and shows the same data.
        </p>
      ) : null}
    </div>
  );
}
