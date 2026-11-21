export type LocaleInfo = { lang: string; name: string; path: string; og: string };
/** A language code: "en" or a pack's lang such as "zh-CN" or "es". */
export type Locale = string;
export type CompiledPack = {
  strings: Record<string, string>;
  patterns: { re: RegExp; value: string }[];
};
export const LOCALES: LocaleInfo[];
export const DEFAULT_LOCALE: "en";
export function isLocale(code: unknown): boolean;
export function localeInfo(code: string): LocaleInfo;
export function localeFromPath(pathname: string | null | undefined): Locale;
export function stripLocale(pathname: string): string;
export function localePath(path: string, locale: Locale): string;
export function matchLocale(wanted: string | readonly string[] | null | undefined): Locale;
export function compilePack(strings: Record<string, string> | null | undefined): CompiledPack;
export function translateWith(pack: CompiledPack | null | undefined, text: string): string;
export function fieldOf(locale: Locale): string;
export function pickText(
  obj: ({ en: string } & Record<string, string | undefined>) | null | undefined,
  locale: Locale,
  translate?: (text: string) => string,
): string;
