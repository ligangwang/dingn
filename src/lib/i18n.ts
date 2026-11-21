// The website's side of dingn's languages (src/data/i18n-core.mjs). A page
// in another language arrives with its language pack (src/app/[lang]/
// layout.tsx registers it); switching language in place fetches the other
// pack from /locales/<lang>.json first (scripts/build-locales.mjs).
import {
  LOCALES,
  compilePack,
  isLocale,
  localeFromPath,
  localeInfo,
  localePath,
  matchLocale,
  pickText,
  stripLocale,
  translateWith,
  type CompiledPack,
  type Locale,
} from "@/data/i18n-core.mjs";

export type { Locale };
export {
  LOCALES,
  isLocale,
  localeFromPath,
  localeInfo,
  localePath,
  matchLocale,
  stripLocale,
};

const packs = new Map<string, CompiledPack>();

/** Makes a language's text available (idempotent). */
export function registerPack(
  locale: Locale,
  strings: Record<string, string> | null | undefined,
) {
  if (locale !== "en" && strings && !packs.has(locale))
    packs.set(locale, compilePack(strings));
}

/** Whether a language's text is here: English always is. */
export const hasPack = (locale: Locale) =>
  locale === "en" || packs.has(locale);

/** Fetches a language's pack, unless it is already here. */
export async function loadPack(locale: Locale) {
  if (hasPack(locale) || !isLocale(locale)) return;
  const response = await fetch(`/locales/${locale}.json`);
  if (!response.ok) throw new Error(`No ${locale} language pack`);
  registerPack(locale, await response.json());
}

/** English text in a language (English as it is until its pack is here). */
export function translate(text: string, locale: Locale): string {
  if (locale === "en" || !text) return text;
  return translateWith(packs.get(locale), text);
}

/** The text of a { en, zh, … } object in a language (see pickText). */
export const pick = (
  obj: ({ en: string } & Record<string, string | undefined>) | null | undefined,
  locale: Locale,
  translated = false,
) =>
  pickText(
    obj,
    locale,
    translated ? (text) => translate(text, locale) : undefined,
  );
