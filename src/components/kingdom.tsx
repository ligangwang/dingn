"use client";
// The kingdom's pages come from the reward system: the build page
// (/kingdom/), a visit to another player's kingdom (player-page.tsx) and the
// account card. dingn loads them at run time from the live plugin version
// (src/lib/reward-plugin.ts) and draws them into an element with their own
// React, giving them plain values: dingn's words, links, coin picture and
// kingdom API (scripts/kingdom.mjs). Until it knows which version is live,
// the space stays empty; with none live, or if it can't load, it says the
// kingdom is unavailable: dingn has no copy of its own.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VisitedKingdom } from "kingdom/ui";
import { pick } from "@/lib/i18n";
import { buildInKingdom, fetchKingdom, moveInKingdom } from "@/lib/kingdom";
import { setWalletCoins } from "@/lib/rewards";
import {
  loadKingdomUi,
  type KingdomUi,
  type LivePlugin,
  type PluginHost,
} from "@/lib/reward-plugin";
import { useLocale } from "./locale";
import { useSession } from "./session";

const api: PluginHost["api"] = {
  fetch: fetchKingdom,
  build: buildInKingdom,
  move: moveInKingdom,
};

/** The coin picture the plugin draws (the same coin as rewards-art's). */
export const COIN_PICTURE = "/coin.svg";

/** dingn's side of the kingdom's pages, as plain values. */
function usePluginHost(): Omit<PluginHost, "assets"> {
  const { t, locale, href } = useLocale();
  const { user } = useSession();
  const router = useRouter();
  const uid = user?.uid ?? "";
  return useMemo(
    () => ({
      locale,
      t,
      // dingn's own names: Chinese in the data, other languages from the packs.
      name: (title) => pick(title, locale, true),
      navigate: (to) => router.push(to),
      coin: COIN_PICTURE,
      links: {
        kingdom: href("/kingdom/"),
        signIn: `${href("/signin/")}?next=${encodeURIComponent(href("/kingdom/"))}`,
        play: href("/play/memory/"),
      },
      api,
      onCoins: (coins) => uid && setWalletCoins(uid, coins),
    }),
    [t, locale, href, uid, router],
  );
}

/** In the kingdom's place when no version is live or it can't load. */
function Unavailable({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  return (
    <p className={`kingdom-unavailable muted ${className}`} role="status">
      {t("The kingdom isn't available right now. Try again in a minute.")}
    </p>
  );
}

type Loaded = { ui: KingdomUi; plugin: LivePlugin } | null;

/** The live plugin's UI: undefined while asking, null if there is none. */
function usePluginUi() {
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void loadKingdomUi().then((ui) => current && setLoaded(ui));
    return () => {
      current = false;
    };
  }, []);
  return loaded;
}

/**
 * Draws one of the plugin's pages into a div and keeps its values current.
 * `mount` picks the page; `props` are its values.
 */
function PluginMount<P>({
  mount,
  props,
  className,
}: {
  mount: (
    element: Element,
    props: P,
  ) => {
    update: (props: P) => void;
    unmount: () => void;
  };
  props: P;
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const mounted = useRef<{ update: (props: P) => void; unmount: () => void }>(
    null,
  );
  useEffect(() => {
    mounted.current = mount(element.current!, props);
    return () => {
      const done = mounted.current;
      mounted.current = null;
      // Not while React is still drawing this page.
      queueMicrotask(() => done?.unmount());
    };
    // Drawn once per mount function; new values go through update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mount]);
  useEffect(() => {
    mounted.current?.update(props);
  }, [props]);
  return <div ref={element} className={className} />;
}

/** The kingdom page. Signed-out visitors see a sample kingdom. */
export function Kingdom() {
  const host = usePluginHost();
  const { user, ready } = useSession();
  const loaded = usePluginUi();
  const player = user?.uid ?? "";
  const props = useMemo(
    () => ({
      host: { ...host, assets: loaded?.plugin.assets },
      player,
      ready,
    }),
    [host, loaded, player, ready],
  );
  if (loaded === undefined) return null;
  if (loaded === null) return <Unavailable className="panel" />;
  return <PluginMount mount={loaded.ui.mountKingdomPage} props={props} />;
}

/** Another player's kingdom, on their public page. */
export function KingdomVisit({
  kingdom,
  label,
}: {
  kingdom: VisitedKingdom;
  label: string;
}) {
  // A visit only needs dingn's words.
  const { t, locale } = useLocale();
  const loaded = usePluginUi();
  const host = useMemo(
    () => ({
      t,
      name: (title: { en: string; zh: string }) => pick(title, locale, true),
    }),
    [t, locale],
  );
  const props = useMemo(
    () => ({
      host: { ...host, assets: loaded?.plugin.assets },
      kingdom,
      label,
    }),
    [host, loaded, kingdom, label],
  );
  if (loaded === undefined) return null;
  if (loaded === null) return <Unavailable />;
  return <PluginMount mount={loaded.ui.mountKingdomVisit} props={props} />;
}

/** The player's kingdom on their account page. */
export function KingdomCard() {
  const host = usePluginHost();
  const loaded = usePluginUi();
  const props = useMemo(
    () => ({ host: { ...host, assets: loaded?.plugin.assets } }),
    [host, loaded],
  );
  if (loaded === undefined) return null;
  if (loaded === null) return <Unavailable className="panel" />;
  return <PluginMount mount={loaded.ui.mountKingdomCard} props={props} />;
}
