// Reads a language pack (locales/<lang>.json) while pages are built. Server
// only: each page gets just its own language's text.
import { readFileSync } from "node:fs";
import path from "node:path";
import { LOCALES } from "@/lib/i18n";
import {
  compilePack,
  translateWith,
  type CompiledPack,
} from "@/data/i18n-core.mjs";

/** The language whose pages live under /<prefix>/ ("es" → "es", "zh" → "zh-CN"). */
export function localeOfPrefix(prefix: string) {
  const found = LOCALES.find((l) => l.path === `/${prefix}`);
  if (!found) throw new Error(`No language at /${prefix}/`);
  return found.lang;
}

/** Every language prefix other than English's, for generateStaticParams. */
export const languagePrefixes = () =>
  LOCALES.filter((l) => l.path).map((l) => ({ lang: l.path.slice(1) }));

/** A language's text, from its pack. */
export function packStrings(locale: string): Record<string, string> {
  const file = path.join(process.cwd(), "locales", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8")).strings;
}

const compiled = new Map<string, CompiledPack>();
/** English text in a language, from its pack, while pages are built. */
export function translateServer(text: string, locale: string): string {
  if (locale === "en") return text;
  if (!compiled.has(locale))
    compiled.set(locale, compilePack(packStrings(locale)));
  return translateWith(compiled.get(locale), text);
}
