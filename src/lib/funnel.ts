// Where players come from and whether they come back: visits, game starts,
// finished rounds, return visits and challenge links, counted by source
// (scripts/funnel.mjs adds them up per day; admins read them on
// /admin/funnel/).
//
// Nothing here identifies a person. This browser remembers only the day of
// its first visit, the source it first came from and the day it was last
// counted, and sends counts with no id. A browser that visited /opt-out sends
// nothing, as with Google Analytics.
import { api } from "./api";
import { consentKey } from "./analytics";
import { challengeFromQuery } from "@/data/challenge.mjs";

export const FUNNEL_KEY = "dingn.funnel.v1";
const SOURCE = /^[a-z0-9_-]{1,40}$/;
/** A browser that comes back within this many days counts toward "returners". */
export const RETURN_DAYS = 7;

export type FunnelState = {
  /** Day of the first visit (UTC, YYYY-MM-DD). */
  first: string;
  /** Where that first visit came from. */
  source: string;
  /** The last day a visit was counted. */
  last: string;
  /** Already counted as coming back within RETURN_DAYS. */
  returned?: boolean;
};
export type FunnelEvent =
  | {
      event: "visit";
      source: string;
      new: boolean;
      /** Came back on a later day. */
      returning: boolean;
      /** The first time it came back, within RETURN_DAYS of the first visit. */
      returner: boolean;
      /** Arrived through a friend's challenge link. */
      referred: boolean;
    }
  | { event: "start" | "finish" | "share"; source: string; game: string };

const day = (now: Date) => now.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** A short label for a source: lowercase, dots and spaces as underscores. */
export function cleanSource(raw: string | null | undefined) {
  const value = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return SOURCE.test(value) ? value : "";
}

/** Well-known sites, by the end of their host name. */
const SITES: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)baidu\.com$/, "baidu"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)bilibili\.com$/, "bilibili"],
  [/(^|\.)weixin\.qq\.com$/, "wechat"],
  [/(^|\.)xiaohongshu\.com$/, "xiaohongshu"],
  [/(^|\.)crazygames\.com$/, "crazygames"],
  [/(^|\.)poki\.com$/, "poki"],
];

/**
 * Where this page view came from: `utm_source` or `ref` in the address, a
 * challenge link, the site that linked here, or "direct".
 */
export function landingSource(href: string, referrer: string) {
  const url = new URL(href);
  const tagged =
    cleanSource(url.searchParams.get("utm_source")) ||
    cleanSource(url.searchParams.get("ref"));
  if (tagged) return tagged;
  if (challengeFromQuery(url.search)) return "challenge";
  let from: URL | null = null;
  try {
    from = referrer ? new URL(referrer) : null;
  } catch {}
  if (!from || from.hostname === url.hostname) return "direct";
  const host = from.hostname.replace(/^www\./, "");
  for (const [pattern, name] of SITES) if (pattern.test(host)) return name;
  return cleanSource(host) || "other";
}

/**
 * The visit to count for this page view, if any, and the browser's new
 * state. At most one visit a day is counted per browser.
 */
export function visitFor(
  state: FunnelState | null,
  source: string,
  now = new Date(),
): { state: FunnelState; event: FunnelEvent | null } {
  const today = day(now);
  if (!state || !state.first || !state.source)
    return {
      state: { first: today, source, last: today },
      event: {
        event: "visit",
        source,
        new: true,
        returning: false,
        returner: false,
        referred: source === "challenge",
      },
    };
  if (state.last === today) return { state, event: null };
  const returner =
    !state.returned && daysBetween(state.first, today) <= RETURN_DAYS;
  return {
    state: {
      ...state,
      last: today,
      ...(returner || state.returned ? { returned: true } : {}),
    },
    event: {
      event: "visit",
      source: state.source,
      new: false,
      returning: true,
      returner,
      referred: false,
    },
  };
}

function optedOut() {
  try {
    return localStorage.getItem(consentKey) === "denied";
  } catch {
    return true;
  }
}
function readState(): FunnelState | null {
  try {
    const value = JSON.parse(localStorage.getItem(FUNNEL_KEY) ?? "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

const send = (event: FunnelEvent) =>
  void api("/api/funnel", event).catch(() => {});

/** Counts this page view as the day's visit, unless this browser opted out. */
export function trackVisit(href = location.href, referrer = document.referrer) {
  if (optedOut()) return;
  const { state, event } = visitFor(readState(), landingSource(href, referrer));
  try {
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(state));
  } catch {
    return;
  }
  if (event) send(event);
}

/** Counts a game start, finished round or challenge link, by first source. */
export function trackGame(event: "start" | "finish" | "share", game: string) {
  if (optedOut()) return;
  const state = readState();
  if (!state) return;
  send({ event, source: state.source, game });
}
