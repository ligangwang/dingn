import zh from "@/data/zh-CN.json";
export type Locale = "en" | "zh-CN";
const catalog: Record<string, string> = zh;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(catalog)
  .filter(([key]) => /\{\d+\}/.test(key))
  .sort(
    ([a], [b]) =>
      b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length,
  )
  .map(([key, value]) => ({
    re: new RegExp(
      "^" +
        key
          .split(/\{\d+\}/)
          .map(escape)
          .join("(.*?)") +
        "$",
    ),
    value,
  }));
export function translate(text: string, locale: Locale): string {
  if (locale === "en" || !text) return text;
  const key = text.replace(/\s+/g, " ").trim();
  if (catalog[key]) return catalog[key];
  for (const { re, value } of patterns) {
    const match = key.match(re);
    if (match)
      return value.replace(/\{(\d+)\}/g, (_, n) => match[Number(n) + 1] ?? "");
  }
  return text;
}
/** Chinese pages live under /zh/; English keeps the original, unprefixed URLs. */
export const zhPrefix = "/zh";
export function localeFromPath(pathname: string | null | undefined): Locale {
  return pathname === zhPrefix || pathname?.startsWith(zhPrefix + "/")
    ? "zh-CN"
    : "en";
}
/** The language-neutral path, e.g. "/zh/word/" → "/word/". */
export function stripLocale(pathname: string): string {
  if (pathname === zhPrefix || pathname === zhPrefix + "/") return "/";
  return pathname.startsWith(zhPrefix + "/")
    ? pathname.slice(zhPrefix.length)
    : pathname;
}
/** The URL of a site path in a language, e.g. ("/word/", "zh-CN") → "/zh/word/". */
export function localePath(path: string, locale: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const bare = stripLocale(path);
  return locale === "zh-CN" ? zhPrefix + bare : bare;
}
