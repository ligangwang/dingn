/**
 * Each language has its own URL: English at the original paths, Chinese under
 * /zh/. Old ?lang= links and /en/ paths move permanently to those URLs.
 */
export function localizedRedirect(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  let { pathname } = url;
  const lang = url.searchParams.get("lang");
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  if (!lang && !isEn) return null;
  if (isEn) pathname = pathname.slice(3) || "/";
  if (lang) {
    url.searchParams.delete("lang");
    const bare = pathname === "/zh" ? "/" : pathname.replace(/^\/zh(?=\/)/, "");
    pathname = lang.toLowerCase().startsWith("zh")
      ? "/zh" + (bare === "/" ? "/" : bare)
      : bare;
  }
  return pathname + url.search;
}

/** Short addresses for the developer pages, on their own (sub)domains. */
export const DEVELOPER_HOSTS = ["developer.dingn.com", "dev.dingn.com"];

/**
 * Where a request to a developer address goes on dingn.com: its root opens
 * the developer guide, and its other pages are the developer pages
 * (developer.dingn.com/playground/ → dingn.com/developers/playground/).
 * Returns null for any other host. Cloud Run's domain mapping keeps the
 * visitor's host in Host; X-Forwarded-Host covers a proxy in front.
 */
export function developerRedirect(headers, requestUrl) {
  const host = String(headers["x-forwarded-host"] || headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (!DEVELOPER_HOSTS.includes(host)) return null;
  const url = new URL(requestUrl, "http://localhost");
  const zh = url.pathname === "/zh" || url.pathname.startsWith("/zh/");
  let rest = zh ? url.pathname.slice(3) || "/" : url.pathname;
  // Links that already name a dingn.com page keep it.
  if (!/^\/(developers|sdk|play|g)(\/|$)/.test(rest))
    rest = "/developers" + (rest === "/" ? "/" : rest);
  return `https://dingn.com${zh ? "/zh" : ""}${rest}${url.search}`;
}

/**
 * Old addresses of games that left the website: Logic and Decisions were
 * retired (their links open the home page), and the Memory games moved into
 * the Memory game at /play/memory/, which opens a lab named in the hash.
 */
const MOVED = {
  logic: "/",
  decisions: "/",
  "memory-ladder": "/play/memory/",
  number: "/play/memory/#number",
  word: "/play/memory/#word",
  card: "/play/memory/#card",
};

/**
 * Where an old link to a moved or retired game goes, in the same language
 * (/word/ → /play/memory/#word, /zh/logic/ → /zh/). Returns null otherwise.
 */
export function retiredRedirect(requestUrl) {
  const { pathname } = new URL(requestUrl, "http://localhost");
  const match = /^(\/zh|\/en)?\/([a-z-]+)\/?$/.exec(pathname);
  const target = match && Object.hasOwn(MOVED, match[2]) && MOVED[match[2]];
  if (!target) return null;
  return match[1] === "/zh" ? "/zh" + target : target;
}
