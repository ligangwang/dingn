import { EmbedChrome } from "@/components/embed-chrome";
import {
  languagePrefixes,
  localeOfPrefix,
  packStrings,
} from "@/lib/packs.server";

/** The embedded player in each other language, at /<prefix>/embed/<id>/. */
export const generateStaticParams = languagePrefixes;
export const dynamicParams = false;

export default async function EmbedLanguageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const locale = localeOfPrefix((await params).lang);
  return (
    <EmbedChrome locale={locale} strings={packStrings(locale)}>
      {children}
    </EmbedChrome>
  );
}
