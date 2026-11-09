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
