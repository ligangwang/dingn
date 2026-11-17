export const measurementId = "G-QDV6QLR932";
export const consentKey = "dingn.analytics-consent.v1";
export type AnalyticsConsent = "granted" | "denied" | null;
const titles: Record<string, string> = {
  "/": "Home",
  "/account/": "Account",
  "/adventure/": "Adventure",
  "/casual/": "Casual",
  "/coins/": "Coins",
  "/developers/": "Developers",
  "/developers/agreement/": "Developer agreement",
  "/developers/games/": "Developer games",
  "/developers/playground/": "Developer playground",
  "/feedback/": "Feedback",
  "/kingdom/": "Kingdom",
  "/memory/": "Memory games",
  "/opt-out/": "Opt out",
  "/privacy/": "Privacy",
  "/puzzle/": "Puzzle",
  "/signin/": "Sign in",
  "/terms/": "Terms",
};
const SEGMENT = /^[a-z0-9][a-z0-9_-]{0,63}$/;
/**
 * Every page is tracked except the admin pages (/admin/ and /zh/admin/).
 * Paths are reduced to plain lowercase segments, so no query, hash or odd
 * text reaches Google; a path that doesn't fit is reported as "/other/".
 */
export function analyticsPage(path: string) {
  const clean = path.split(/[?#]/)[0];
  const normalized = clean.endsWith("/") ? clean : clean + "/";
  const zh = normalized === "/zh/" || normalized.startsWith("/zh/");
  const rest = zh ? normalized.slice(3) || "/" : normalized;
  const segments = rest.split("/").filter(Boolean);
  if (segments[0] === "admin") return null;
  if (!segments.every((part) => SEGMENT.test(part)))
    return { path: zh ? "/zh/other/" : "/other/", title: "Other" };
  const title =
    titles[rest] ??
    (segments[0] === "play" && segments.length === 2
      ? `Play ${segments[1]}`
      : segments.join(" / "));
  return {
    path: normalized,
    title: zh ? `${title} (zh)` : title,
  };
}
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  dingnAnalyticsStarted?: boolean;
  dingnAnalyticsPage?: string;
};
export function syncAnalytics(
  consent: AnalyticsConsent,
  pathname: string,
  hostname = window.location.hostname,
) {
  const w = window as AnalyticsWindow;
  const page = analyticsPage(pathname);
  const allowed =
    consent === "granted" &&
    ["dingn.com", "www.dingn.com"].includes(hostname) &&
    !!page;
  (w as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] =
    !allowed;
  if (!allowed) {
    if (w.dingnAnalyticsStarted && consent !== "granted")
      w.gtag!("consent", "update", { analytics_storage: "denied" });
    w.dingnAnalyticsPage = undefined;
    return;
  }
  if (!w.dingnAnalyticsStarted) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function (..._args: unknown[]) {
      w.dataLayer!.push(arguments);
    };
    w.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    w.gtag("js", new Date());
    w.gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: `https://dingn.com${page!.path}`,
      page_referrer: "",
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.id = "dingn-google-analytics";
    document.head.appendChild(script);
    w.dingnAnalyticsStarted = true;
  }
  if (w.dingnAnalyticsPage === page!.path) return;
  w.gtag!("consent", "update", { analytics_storage: "granted" });
  const referrer = w.dingnAnalyticsPage
    ? `https://dingn.com${w.dingnAnalyticsPage}`
    : "";
  const values = {
    page_location: `https://dingn.com${page!.path}`,
    page_title: page!.title,
    page_referrer: referrer,
  };
  w.gtag!("set", values);
  w.gtag!("event", "page_view", { ...values, send_to: measurementId });
  w.dingnAnalyticsPage = page!.path;
}
export function clearAnalyticsCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (name === "_ga" || name.startsWith("_ga_")) {
      for (const domain of [
        "",
        "; domain=dingn.com",
        "; domain=.dingn.com",
        "; domain=www.dingn.com",
      ]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
      }
    }
  }
}
