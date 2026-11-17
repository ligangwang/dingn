"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  consentKey,
  clearAnalyticsCookies,
  syncAnalytics,
  type AnalyticsConsent,
} from "@/lib/analytics";
import { FUNNEL_KEY, trackVisit } from "@/lib/funnel";

const isOptOut = (path: string) =>
  ["/opt-out", "/zh/opt-out"].includes(path.replace(/\/$/, ""));

/**
 * Google Analytics runs by default. Visiting /opt-out (or /zh/opt-out) stores a denial in this
 * browser, which turns it off and clears the GA cookies from then on. The
 * same denial turns off dingn's own visit counts (src/lib/funnel.ts).
 */
export function Analytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsConsent>(null);
  useEffect(() => {
    if (isOptOut(window.location.pathname)) {
      try {
        localStorage.setItem(consentKey, "denied");
        localStorage.removeItem(FUNNEL_KEY);
      } catch {}
      setChoice("denied");
      syncAnalytics("denied", "/opt-out/");
      clearAnalyticsCookies();
      return;
    }
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(consentKey);
    } catch {}
    setChoice(saved === "denied" ? "denied" : "granted");
    // dingn's own visit counts (src/lib/funnel.ts); opted out sends nothing.
    trackVisit();
    const changed = (event: StorageEvent) => {
      if (event.key === consentKey)
        setChoice(event.newValue === "denied" ? "denied" : "granted");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [pathname]);
  useEffect(() => {
    if (choice === null) return;
    syncAnalytics(isOptOut(pathname) ? "denied" : choice, pathname);
    if (choice === "denied") clearAnalyticsCookies();
  }, [choice, pathname]);
  return null;
}
