export const measurementId = "G-QDV6QLR932";
export const consentKey = "dingn.analytics-consent.v1";
export type AnalyticsConsent = "granted" | "denied" | null;
const pages: Record<string, string> = {
  "/": "Home",
  "/word/": "Words",
  "/number/": "Numbers",
  "/card/": "Cards",
  "/signin/": "Sign in",
  "/feedback/": "Feedback",
};
export function analyticsPage(path: string) {
  const clean = path.split(/[?#]/)[0];
  const normalized = clean.endsWith("/") ? clean : clean + "/";
  return pages[normalized]
    ? { path: normalized, title: pages[normalized] }
    : null;
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
