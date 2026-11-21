import { SiteChrome } from "@/components/site-chrome";
import {
  languagePrefixes,
  localeOfPrefix,
  packStrings,
} from "@/lib/packs.server";

/** One copy of the site per language pack (locales/*.json), under its prefix. */
export const generateStaticParams = languagePrefixes;
export const dynamicParams = false;

/** Pages in another language: the frame in that language, with its pack's text. */
export default async function LanguageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const locale = localeOfPrefix((await params).lang);
  return (
    <SiteChrome locale={locale} strings={packStrings(locale)}>
      {children}
    </SiteChrome>
  );
}
