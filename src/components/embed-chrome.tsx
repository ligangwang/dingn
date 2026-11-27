import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/locale";
import type { Locale } from "@/lib/i18n";

/**
 * Around the embedded player (/embed/<id>/), which other websites put in a
 * frame: only its language. It has no header, footer, session or Google
 * Analytics, unlike a page of the site (src/components/site-chrome.tsx):
 * the frame is the game, played as a guest.
 */
export function EmbedChrome({
  children,
  locale,
  strings,
}: {
  children: ReactNode;
  locale?: Locale;
  strings?: Record<string, string>;
}) {
  return (
    <LocaleProvider locale={locale} strings={strings}>
      <main id="main" className="embed-main">
        {children}
      </main>
    </LocaleProvider>
  );
}
