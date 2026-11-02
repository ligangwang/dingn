"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  consentKey,
  clearAnalyticsCookies,
  syncAnalytics,
  type AnalyticsConsent,
} from "@/lib/analytics";

const isOptOut = (path: string) => path.replace(/\/$/, "") === "/opt-out";

/**
 * Google Analytics runs by default. Visiting /opt-out stores a denial in this
 * browser, which turns it off and clears the GA cookies from then on.
 */
export function Analytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsConsent>(null);
  useEffect(() => {
    if (isOptOut(window.location.pathname)) {
      try {
        localStorage.setItem(consentKey, "denied");
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
