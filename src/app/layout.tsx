import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { SessionProvider } from "@/components/session";
import { Header } from "@/components/header";
import { LegacyRoutes } from "@/components/legacy-routes";
import { Analytics } from "@/components/analytics";
import "./globals.css";
import "./mind-arcade.css";
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "Dingn — Memory, Logic & Decisions",
    template: "%s · dingn",
  },
  description:
    "Play memory challenges, logic puzzles, and decision-making games in the Dingn mind arcade.",
  icons: { icon: "/dingn-mark.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
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
