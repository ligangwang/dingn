import { LocaleHtml, LocaleProvider, Text } from "@/components/locale";
import type { Metadata } from "next";
import { SessionProvider } from "@/components/session";
import { Header } from "@/components/header";
import { LegacyRoutes } from "@/components/legacy-routes";
import { Analytics } from "@/components/analytics";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import "./mind-arcade.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://dingn.com"),
  title: {
    default: "dingn — Games & Adventures | 游戏与冒险",
    template: "%s · dingn",
  },
  description:
    "Discover games on dingn, home of Memory Ladder. 探索 dingn 游戏平台，畅玩记忆阶梯。",
  icons: { icon: "/dingn-mark.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleHtml>
      <body>
        <LocaleProvider>
          <a className="skip-link" href="#main">
            <Text>Skip to content</Text>
          </a>
          <SessionProvider>
            <LegacyRoutes />
            <Header />
            <main id="main">{children}</main>
            <footer>
              <Text>dingn · A world of games. A spark of adventure.</Text> ·{" "}
              <a href="/models/crowd/CREDITS.md">
                <Text>Credits</Text>
              </a>
            </footer>
            <Analytics />
          </SessionProvider>
        </LocaleProvider>
      </body>
    </LocaleHtml>
  );
}
