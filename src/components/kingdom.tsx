"use client";
// The kingdom's pages come from the reward system (the kingdom package's
// kingdom/ui): the build page (/kingdom/), a visit to another player's
// kingdom (player-page.tsx) and the account card. dingn gives them its
// words, links, coin picture and kingdom API (scripts/kingdom.mjs) here.
import { useMemo } from "react";
import Link from "next/link";
import {
  KingdomCard as Card,
  KingdomPage,
  KingdomVisit as Visit,
  type KingdomHost,
  type VisitedKingdom,
} from "kingdom/ui";
import "kingdom/ui/kingdom.css";
import { pick } from "@/lib/i18n";
import { buildInKingdom, fetchKingdom, moveInKingdom } from "@/lib/kingdom";
import { setWalletCoins } from "@/lib/rewards";
import { useLocale } from "./locale";
import { useSession } from "./session";
import { Coin } from "./rewards-art";

const api: KingdomHost["api"] = {
  fetch: fetchKingdom,
  build: buildInKingdom,
  move: moveInKingdom,
};

function useKingdomHost(): KingdomHost {
  const { t, locale, href } = useLocale();
  const { user } = useSession();
  const uid = user?.uid ?? "";
  return useMemo(
    () => ({
      locale,
      t,
      // dingn's own names: Chinese in the data, other languages from the packs.
      name: (title) => pick(title, locale, true),
      Link,
      Coin,
      links: {
        kingdom: href("/kingdom/"),
        signIn: `${href("/signin/")}?next=${encodeURIComponent(href("/kingdom/"))}`,
        play: href("/play/memory/"),
      },
      api,
      onCoins: (coins) => uid && setWalletCoins(uid, coins),
    }),
    [t, locale, href, uid],
  );
}

/** The kingdom page. Signed-out visitors see a sample kingdom. */
export function Kingdom() {
  const host = useKingdomHost();
  const { user, ready } = useSession();
  return <KingdomPage host={host} player={user?.uid ?? ""} ready={ready} />;
}

/** Another player's kingdom, on their public page. */
export function KingdomVisit(props: {
  kingdom: VisitedKingdom;
  label: string;
}) {
  return <Visit host={useKingdomHost()} {...props} />;
}

/** The player's kingdom on their account page. */
export function KingdomCard() {
  return <Card host={useKingdomHost()} />;
}
