import type { ReactNode } from "react";
import { LocaleProvider, Text } from "@/components/locale";
import { SessionProvider } from "@/components/session";
import { Header } from "@/components/header";
import { LegacyRoutes } from "@/components/legacy-routes";
import { Analytics } from "@/components/analytics";
import { DevelopersLink } from "@/components/developers";
import { LegalLinks } from "@/components/legal";
import type { Locale } from "@/lib/i18n";

/**
 * Everything around a page: its language, the session, the header and the
 * footer. English pages (src/app/(en)/) give no language; other languages
 * (src/app/[lang]/) give theirs and its pack's text.
 */
export function SiteChrome({
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
      <a className="skip-link" href="#main">
        <Text>Skip to content</Text>
      </a>
      <SessionProvider>
        <LegacyRoutes />
        <Header />
        <main id="main">{children}</main>
        <footer>
          dingn ·{" "}
          <a href="/models/CREDITS.md">
            <Text>Credits</Text>
          </a>{" "}
          · <DevelopersLink /> · <LegalLinks />
        </footer>
        <Analytics />
      </SessionProvider>
    </LocaleProvider>
  );
}
