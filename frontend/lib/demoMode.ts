"use client";

/**
 * Demo Mode — a client-only flag that lets a visitor preview the platform
 * populated with the bundled sample dataset (lib/mockData.ts) WITHOUT
 * creating an account or writing anything to the real backend/profile.
 *
 * Intentionally NOT a real data source: no live API call, no seeded DB rows,
 * nothing "as-if-live" — just a localStorage flag other pages can check to
 * decide "render lib/mockData.ts instead of fetching real data". Today only
 * the onboarding page (entry point) and the Command Center dashboard
 * (frontend/app/page.tsx) read it; other modules can opt in later by calling
 * `useDemoMode()` the same way.
 *
 * Deliberately a plain localStorage flag + hook (no React Context/Provider)
 * so it doesn't require touching frontend/app/layout.tsx to wire up a new
 * top-level provider — every consumer just calls `useDemoMode()` and stays
 * in sync via a same-tab CustomEvent (instant) and the native `storage`
 * event (cross-tab).
 */

import { useEffect, useState } from "react";

const DEMO_MODE_KEY = "ji_demo_mode";
const DEMO_MODE_EVENT = "ji-demo-mode-changed";

/**
 * Read the current demo-mode flag directly. Safe to call outside React
 * (e.g. inside a fetch wrapper) and during SSR (always returns false there —
 * demo mode is a browser-only concept).
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function broadcast(active: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEMO_MODE_EVENT, { detail: active }));
}

/**
 * Turn demo mode on. From this point, any page that checks `isDemoMode()` /
 * `useDemoMode()` should render `lib/mockData.ts` content instead of doing a
 * real fetch. Never touches the real profile or backend.
 */
export function enableDemoMode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_MODE_KEY, "1");
  } catch {
    /* localStorage unavailable (private mode / quota) — degrade silently */
  }
  broadcast(true);
}

/** Turn demo mode off and return to real data. */
export function disableDemoMode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEMO_MODE_KEY);
  } catch {
    /* ignore */
  }
  broadcast(false);
}

export interface UseDemoModeResult {
  /** Whether demo mode is currently active. */
  demoMode: boolean;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
}

/**
 * React hook for reading + toggling demo mode from any client component.
 * Reconciles once after mount (SSR always starts `false`), then reacts to
 * same-tab toggles (CustomEvent) and cross-tab toggles (`storage` event) so
 * every mounted consumer — banner, onboarding CTA, dashboard, etc. — stays
 * in sync without a shared Context/Provider.
 */
export function useDemoMode(): UseDemoModeResult {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    // Reconcile after hydration — server render always starts `false`.
    setDemoMode(isDemoMode());

    const onCustomChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setDemoMode(typeof detail === "boolean" ? detail : isDemoMode());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_MODE_KEY) setDemoMode(e.newValue === "1");
    };

    window.addEventListener(DEMO_MODE_EVENT, onCustomChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DEMO_MODE_EVENT, onCustomChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { demoMode, enableDemoMode, disableDemoMode };
}
