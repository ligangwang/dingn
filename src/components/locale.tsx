"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translate, type Locale } from "@/lib/i18n";
const LocaleContext = createContext({
  locale: "en" as Locale,
  setLocale: (_locale: Locale) => {},
});
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("dingn.locale");
    } catch {}
    const requested = new URLSearchParams(window.location.search).get("lang");
    const value = requested || saved || navigator.language;
    if (requested) {
      try {
        localStorage.setItem(
          "dingn.locale",
          requested.toLowerCase().startsWith("zh") ? "zh-CN" : "en",
        );
      } catch {}
    }
    setLocale(value?.toLowerCase().startsWith("zh") ? "zh-CN" : "en");
    const changed = (event: StorageEvent) => {
      if (event.key === "dingn.locale")
        setLocale(event.newValue === "zh-CN" ? "zh-CN" : "en");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  function change(value: Locale) {
    setLocale(value);
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", value);
      window.history.replaceState(window.history.state, "", url);
    }
    try {
      localStorage.setItem("dingn.locale", value);
    } catch {}
  }
  return (
    <LocaleContext.Provider value={{ locale, setLocale: change }}>
      {children}
    </LocaleContext.Provider>
  );
}
export function useLocale() {
  const value = useContext(LocaleContext);
  return { ...value, t: (text: string) => translate(text, value.locale) };
}
export function Text({ children }: { children: string }) {
  return <>{useLocale().t(children)}</>;
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="language-switch">
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
