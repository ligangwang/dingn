// The server's side of dingn's languages (src/data/i18n-core.mjs): it reads
// the language packs in locales/ (scripts/build-locales.mjs) when first
// needed, for the pages and previews it fills in.
import { readFileSync } from "node:fs";
import {
  LOCALES,
  compilePack,
  localeInfo,
  pickText,
  translateWith,
} from "../src/data/i18n-core.mjs";

export * from "../src/data/i18n-core.mjs";

const packs = new Map();
function pack(locale) {
  if (!packs.has(locale)) {
    let strings = {};
    try {
      strings = JSON.parse(
        readFileSync(new URL(`../locales/${locale}.json`, import.meta.url)),
      ).strings;
    } catch {
      // No pack: English as it is.
    }
    packs.set(locale, compilePack(strings));
  }
  return packs.get(locale);
}

/** English text in a language (as it is in English, or without a pack). */
export const translate = (text, locale) =>
  locale === "en" ? text : translateWith(pack(locale), text);

/** The text of a { en, zh, … } object in a language; dingn's own data is translated. */
export const pick = (obj, locale, translated = false) =>
  pickText(obj, locale, translated ? (t) => translate(t, locale) : undefined);

/** Every language prefix but English's, for URL patterns: "zh|es|pt|…". */
export const PREFIXES = LOCALES.filter((l) => l.path)
  .map((l) => l.path.slice(1))
  .join("|");

/** The language of a prefix ("es"), English for none. */
export const localeOfPrefix = (prefix) =>
  prefix ? (LOCALES.find((l) => l.path === `/${prefix}`)?.lang ?? "en") : "en";

/** A language's URL prefix without the slash ("es"), "" for English. */
export const prefixOf = (locale) => localeInfo(locale).path.slice(1);
