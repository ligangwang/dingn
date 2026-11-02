"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  consentKey,
  clearAnalyticsCookies,
  syncAnalytics,
  type AnalyticsConsent,
} from "@/lib/analytics";
export function Analytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsConsent>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, "") === "/opt-out") {
      try {
        localStorage.setItem(consentKey, "denied");
      } catch {}
      setChoice("denied");
      syncAnalytics("denied", "/opt-out/");
      clearAnalyticsCookies();
      setReady(true);
      return;
    }
    try {
      const saved = localStorage.getItem(consentKey);
      if (saved === "granted" || saved === "denied") setChoice(saved);
    } catch {}
    setReady(true);
    const changed = (event: StorageEvent) => {
      if (event.key === consentKey)
        setChoice(event.newValue === "granted" ? "granted" : "denied");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [pathname]);
  useEffect(() => {
    if (ready) {
      syncAnalytics(
        pathname.replace(/\/$/, "") === "/opt-out" ? "denied" : choice,
        pathname,
      );
      if (choice === "denied") clearAnalyticsCookies();
    }
  }, [choice, pathname, ready]);
  function choose(value: "granted" | "denied") {
    syncAnalytics(value, pathname);
    if (value === "denied") clearAnalyticsCookies();
    try {
      localStorage.setItem(consentKey, value);
    } catch {}
    setChoice(value);
  }
  return (
    <>
      {ready &&
        choice === null &&
        pathname.replace(/\/$/, "") !== "/opt-out" && (
          <section
            className="analytics-choice"
            aria-label="Analytics preferences"
          >
            <div>
              <strong>Help us improve dingn</strong>
              <p>
                Allow Google Analytics cookies to measure page visits? Your
                feedback, email, and account details are not sent.
              </p>
            </div>
            <div className="analytics-actions">
              <button
                className="secondary-button"
                onClick={() => choose("denied")}
              >
                Decline
              </button>
              <button className="button" onClick={() => choose("granted")}>
                Allow analytics
              </button>
            </div>
          </section>
        )}
    </>
  );
}
