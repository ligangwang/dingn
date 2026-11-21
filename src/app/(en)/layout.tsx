import { SiteChrome } from "@/components/site-chrome";
/** English pages: dingn's own language, at the original URLs. */
export default function EnglishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteChrome>{children}</SiteChrome>;
}
