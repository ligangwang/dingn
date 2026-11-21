"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  LOCALES,
  hasPack,
  isLocale,
  loadPack,
  localeFromPath,
  localePath,
  matchLocale,
  pick,
  registerPack,
  translate,
  type Locale,
} from "@/lib/i18n";
const storageKey = "dingn.locale";
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
 * The page's language comes from its URL: English at the original URLs,
 * every other language under its prefix (/zh/, /es/, …), so each language
 * can be indexed. A page in another language passes its pack's text
 * (`strings`), so the page renders in it straight away.
 */
export function LocaleProvider({
  children,
  locale: fixed,
  strings,
}: {
  children: ReactNode;
  locale?: Locale;
  /** The page language's pack, from src/app/[lang]/layout.tsx. */
  strings?: Record<string, string>;
}) {
  if (fixed) registerPack(fixed, strings);
  const pathname = usePathname();
  // Set while switching in place, until the router reports the new URL.
  const [switched, setSwitched] = useState<Locale | null>(null);
  useEffect(() => setSwitched(null), [pathname]);
  // The page's address decides, so a switch (which changes the address)
  // holds after the router catches up; `fixed` only seeds the first render
  // where no address is known yet.
  const path =
    pathname ?? (typeof window === "undefined" ? null : location.pathname);
  const locale = switched ?? (path ? localeFromPath(path) : (fixed ?? "en"));
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
      const chosen = matchLocale(requested);
      try {
        localStorage.setItem(storageKey, chosen);
      } catch {}
      show(chosen);
      return;
    }
    // English URLs are the default: send visitors who chose another language,
    // or whose browser prefers one dingn speaks, to that language's page. An
    // explicit language URL always wins.
    if (locale !== "en") return;
    const wanted =
      saved && isLocale(saved)
        ? saved
        : matchLocale(navigator.languages ?? [navigator.language]);
    if (wanted !== "en") show(wanted);
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
  // The other language's pack is fetched first.
  function show(value: Locale) {
    const go = () => {
      try {
        history.replaceState(history.state, "", urlFor(value));
      } catch {}
      if (value !== locale) setSwitched(value);
    };
    if (hasPack(value)) go();
    else void loadPack(value).then(go, () => {});
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
    /** The text of a { en, zh, … } object in this language (see pick). */
    pick: (
      obj:
        | ({ en: string } & Record<string, string | undefined>)
        | null
        | undefined,
      translated = false,
    ) => pick(obj, value.locale, translated),
    /** A site path in the current language, e.g. "/casual/" → "/es/casual/". */
    href: (path: string) => localePath(path, value.locale),
  };
}
/**
 * A translated sentence with a link (or other element) where its "{0}" is,
 * so each language can put the link wherever its word order needs it.
 */
export function aroundLink(sentence: string, link: ReactNode) {
  const [before, after = ""] = sentence.split("{0}");
  return (
    <>
      {before}
      {link}
      {after}
    </>
  );
}
export function Text({ children }: { children: string }) {
  return <>{useLocale().t(children)}</>;
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="language-switch" title="Language">
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
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {LOCALES.map((l) => (
          <option key={l.lang} value={l.lang} lang={l.lang}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
