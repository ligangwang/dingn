"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { localeFromPath, localePath, translate, type Locale } from "@/lib/i18n";
const storageKey = "dingn.locale";
const normalize = (value: string | null | undefined): Locale =>
  value?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
const LocaleContext = createContext({
  locale: "en" as Locale,
  setLocale: (_locale: Locale) => {},
});
/** The same page in another language, keeping query and hash (minus the legacy ?lang=). */
function urlFor(locale: Locale) {
  const url = new URL(window.location.href);
  url.searchParams.delete("lang");
  return localePath(url.pathname, locale) + url.search + url.hash;
}
/**
 * The page's language comes from its URL: Chinese pages live under /zh/ and
 * English pages keep the original URLs, so each language can be indexed.
 */
export function LocaleProvider({
  children,
  locale: fixed,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const pathname = usePathname();
  // Set while switching in place, until the router reports the new URL.
  const [switched, setSwitched] = useState<Locale | null>(null);
  useEffect(() => setSwitched(null), [pathname]);
  const locale =
    switched ??
    fixed ??
    localeFromPath(
      pathname ?? (typeof window === "undefined" ? "/" : location.pathname),
    );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {}
    // Old ?lang= links (the server normally redirects these already).
    const requested = new URLSearchParams(location.search).get("lang");
    if (requested) {
      try {
        localStorage.setItem(storageKey, normalize(requested));
      } catch {}
      show(normalize(requested));
      return;
    }
    // English URLs are the default: send visitors who chose Chinese, or whose
    // browser prefers it, to the Chinese page. An explicit /zh/ URL always wins.
    if (locale === "en" && normalize(saved || navigator.language) === "zh-CN")
      show("zh-CN");
    // Only on first load: in-app links already stay in the current language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function change(value: Locale) {
    try {
      localStorage.setItem(storageKey, value);
    } catch {}
    show(value);
  }
  // Swap to the other language's URL without a reload, so a game in progress
  // keeps its state; reloading or sharing the link opens that URL directly.
  function show(value: Locale) {
    try {
      history.replaceState(history.state, "", urlFor(value));
    } catch {}
    if (value !== locale) setSwitched(value);
  }
  return (
    <LocaleContext.Provider value={{ locale, setLocale: change }}>
      {children}
    </LocaleContext.Provider>
  );
}
/** The root <html>, with lang matching the page's URL so crawlers see it in the HTML. */
export function LocaleHtml({ children }: { children: ReactNode }) {
  return (
    <html lang={localeFromPath(usePathname())} suppressHydrationWarning>
      {children}
    </html>
  );
}
export function useLocale() {
  const value = useContext(LocaleContext);
  return {
    ...value,
    t: (text: string) => translate(text, value.locale),
    /** A site path in the current language, e.g. "/word/" → "/zh/word/". */
    href: (path: string) => localePath(path, value.locale),
  };
}
export function Text({ children }: { children: string }) {
  return <>{useLocale().t(children)}</>;
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="language-switch" title="Language / 语言">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </svg>
      <span className="sr-only">Language / 语言</span>
      <select
        aria-label="Language / 语言"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="en">English</option>
        <option value="zh-CN">简体中文</option>
      </select>
    </label>
  );
}
