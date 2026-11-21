// The languages dingn speaks, shared by the website and the server. English
// is dingn's own language, at the original URLs; every other language is a
// pack in locales/ (scripts/build-locales.mjs) whose pages live under its
// prefix, such as /es/. Text is translated by its English wording: a pack's
// `strings` maps English to the language, with "{0}"-style patterns for text
// that has numbers or names in it.
import { LOCALES } from "./locales.gen.mjs";

export { LOCALES };
export const DEFAULT_LOCALE = "en";

/** Whether `code` is one of dingn's languages. */
export const isLocale = (code) => LOCALES.some((l) => l.lang === code);
/** A language's details, English for an unknown code. */
export const localeInfo = (code) =>
  LOCALES.find((l) => l.lang === code) ?? LOCALES[0];

/** The language of a page from its URL path: "/es/casual/" → "es". */
export function localeFromPath(pathname) {
  for (const l of LOCALES)
    if (l.path && (pathname === l.path || pathname?.startsWith(l.path + "/")))
      return l.lang;
  return DEFAULT_LOCALE;
}

/** The language-neutral path: "/es/casual/" → "/casual/". */
export function stripLocale(pathname) {
  const { path } = localeInfo(localeFromPath(pathname));
  if (!path) return pathname;
  return pathname === path ? "/" : pathname.slice(path.length);
}

/** A site path in a language: ("/casual/", "es") → "/es/casual/". */
export function localePath(path, locale) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return localeInfo(locale).path + stripLocale(path);
}

/**
 * The language a visitor wants, from a browser language list such as
 * navigator.languages or an Accept-Language header ("pt-BR,pt;q=0.9,en"):
 * an exact match first, then the same base language ("pt" for "pt-BR").
 * English when none matches.
 */
export function matchLocale(wanted) {
  const list = (Array.isArray(wanted) ? wanted : String(wanted ?? "").split(","))
    .map((w) => String(w).split(";")[0].trim())
    .filter(Boolean);
  for (const w of list) {
    const exact = LOCALES.find((l) => l.lang.toLowerCase() === w.toLowerCase());
    if (exact) return exact.lang;
    const base = w.toLowerCase().split("-")[0];
    const same = LOCALES.find((l) => l.lang.toLowerCase().split("-")[0] === base);
    if (same) return same.lang;
  }
  return DEFAULT_LOCALE;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pack's text, ready for translate(): exact strings and "{0}" patterns. */
export function compilePack(strings) {
  const patterns = Object.entries(strings ?? {})
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
  return { strings: strings ?? {}, patterns };
}

/** English text in a compiled pack's language, or as it is when the pack lacks it. */
export function translateWith(pack, text) {
  if (!pack || !text) return text;
  const key = text.replace(/\s+/g, " ").trim();
  if (Object.hasOwn(pack.strings, key)) return pack.strings[key];
  for (const { re, value } of pack.patterns) {
    const match = key.match(re);
    if (match)
      return value.replace(/\{(\d+)\}/g, (_, n) => match[Number(n) + 1] ?? "");
  }
  return text;
}

/** The field a language has in { en, zh, … } text objects (games, data). */
export const fieldOf = (locale) => (locale === "zh-CN" ? "zh" : locale);

/**
 * The text of a { en, zh, … } object in a language: its own field when it has
 * one, otherwise the English, translated by `translate` when given (data
 * dingn wrote itself) or as it is (a game's own title).
 */
export function pickText(obj, locale, translate) {
  if (!obj) return "";
  const own = obj[fieldOf(locale)] ?? obj[locale];
  if (typeof own === "string" && own) return own;
  return translate ? translate(obj.en) : obj.en;
}
