import type { Metadata } from "next";
import { SessionProvider } from "@/components/session";
import { Header } from "@/components/header";
import { LegacyRoutes } from "@/components/legacy-routes";
import { Analytics } from "@/components/analytics";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import "./mind-arcade.css";
export const metadata: Metadata = {
  title: {
    default: "dingn — Memory, Logic & Decisions",
    template: "%s · dingn",
  },
  description:
    "Play memory challenges, logic puzzles, and decision-making games in the dingn mind arcade.",
  icons: { icon: "/dingn-mark.svg" },
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
          <footer>dingn · Remember. Reason. Decide.</footer>
          <Analytics />
        </SessionProvider>
      </body>
    </html>
  );
}
