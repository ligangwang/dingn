import type { Metadata } from "next";
import { SessionProvider } from "@/components/session";
import { Header } from "@/components/header";
import { LegacyRoutes } from "@/components/legacy-routes";
import { Analytics } from "@/components/analytics";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "dingn — Make room for remarkable recall",
    template: "%s · dingn",
  },
  description:
    "Practice remembering numbers, words, and playing cards with the Major System.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SessionProvider>
          <LegacyRoutes />
          <Header />
          <main id="main">{children}</main>
          <footer>dingn · A little practice, every day.</footer>
          <Analytics />
        </SessionProvider>
      </body>
    </html>
  );
}
