import { LocaleHtml } from "@/components/locale";
import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import "./mind-arcade.css";
import "./catalog.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://dingn.com"),
  title: {
    default: "dingn — Free online games & adventures",
    template: "%s · dingn",
  },
  description:
    "Play free games in your browser on dingn. No download, no sign-in needed.",
  icons: { icon: "/dingn-mark.svg" },
};
/**
 * The <html> of every page. The page frame and its language come from the
 * English pages' layout (src/app/(en)/layout.tsx) or another language's
 * (src/app/[lang]/layout.tsx).
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleHtml>
      <body>{children}</body>
    </LocaleHtml>
  );
}
