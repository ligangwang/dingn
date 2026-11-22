// The kingdom as a plugin, loaded at run time like a game
// (scripts/reward-plugin.mjs). The server says which approved version is
// live (GET /api/rewards/live); the pages then import its rules (for honors
// and stages) and its UI (for the kingdom's pages) from
// /rewards/kingdom/<version>/. dingn has no copy of its own (the `kingdom`
// package is only a dev dependency, for its types and the tests): until the
// rules arrive, or if no version is live or it can't load, there are none,
// and the pages leave out what needs them.
import { useEffect, useSyncExternalStore } from "react";
import type * as rewards from "kingdom/rewards";
import type * as levels from "kingdom/levels";
import type * as honors from "kingdom/honors";
import type * as coins from "kingdom/coins";
import type * as kingdom from "kingdom/kingdom";
import type { KingdomApiError, KingdomView, VisitedKingdom } from "kingdom/ui";

/** The plugin contract dingn speaks (kingdom's PLUGIN_API). */
export const PLUGIN_API = 1;

/** The kingdom's rules the pages draw with. */
export type KingdomRules = {
  version: string;
  rewards: typeof rewards;
  levels: typeof levels;
  honors: typeof honors;
  coins: typeof coins;
  kingdom: typeof kingdom;
};

/** Where the live version's files are (GET /api/rewards/live). */
export type LivePlugin = {
  version: string;
  base: string;
  rules: string;
  ui: string;
  css: string;
  assets: string;
};

/** What a page gives the plugin's UI: plain values, no React components. */
export type PluginHost = {
  locale: string;
  t: (text: string) => string;
  name: (title: { en: string; zh: string }) => string;
  navigate: (href: string) => void;
  coin: string;
  links: { kingdom: string; signIn: string; play: string };
  api: {
    fetch: () => Promise<KingdomView>;
    build: (
      building: string,
      x: number,
      y: number,
    ) => Promise<KingdomView & { paid: number }>;
    move: (
      from: [number, number],
      to: [number, number],
    ) => Promise<KingdomView>;
  };
  onCoins?: (coins: number) => void;
  assets?: string;
};
export type { KingdomApiError };

type Mounted<P> = { update: (props: P) => void; unmount: () => void };
/** The plugin's UI module (kingdom's src/ui/mount.tsx). */
export type KingdomUi = {
  mountKingdomPage: (
    element: Element,
    props: { host: PluginHost; player: string; ready: boolean },
  ) => Mounted<{ host: PluginHost; player: string; ready: boolean }>;
  mountKingdomVisit: (
    element: Element,
    props: {
      host: Pick<PluginHost, "t" | "name" | "assets">;
      kingdom: VisitedKingdom;
      label: string;
    },
  ) => Mounted<{
    host: Pick<PluginHost, "t" | "name" | "assets">;
    kingdom: VisitedKingdom;
    label: string;
  }>;
  mountKingdomCard: (
    element: Element,
    props: { host: PluginHost },
  ) => Mounted<{ host: PluginHost }>;
};

let rules: KingdomRules | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The live plugin's rules, or null until they load (or if they can't). */
export const kingdomRules = () => rules;

/** The rules, redrawing the component when the live plugin's arrive. */
export function useKingdomRules(): KingdomRules | null {
  useEffect(() => {
    void loadKingdomRules();
  }, []);
  return useSyncExternalStore(subscribe, kingdomRules, () => null);
}

/** Uses `module` (kingdom/rules) as the live rules, or none with null: for tests. */
export function setKingdomRules(
  module: Omit<KingdomRules, "version"> | null,
  version = "test",
) {
  rules = module && { ...module, version };
  loadingRules = Promise.resolve(rules);
  listeners.forEach((listener) => listener());
}

// A URL import the bundler must leave alone: the browser fetches it.
const importUrl = (url: string): Promise<unknown> =>
  import(/* webpackIgnore: true */ /* @vite-ignore */ url);

let live: Promise<LivePlugin | null> | null = null;

/** The live plugin, or null with none live. Asked once per page load. */
export function livePlugin(): Promise<LivePlugin | null> {
  live ??= fetch("/api/rewards/live", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((systems) => (systems?.kingdom as LivePlugin | null) ?? null)
    .catch(() => null);
  return live;
}

let loadingRules: Promise<KingdomRules | null> | null = null;

/** Loads the live plugin's rules, so the pages draw what the server runs. */
export function loadKingdomRules(): Promise<KingdomRules | null> {
  loadingRules ??= livePlugin().then(async (plugin) => {
    if (!plugin) return rules;
    try {
      const module = (await importUrl(plugin.rules)) as Omit<
        KingdomRules,
        "version"
      > & { PLUGIN_API?: number };
      if (module.PLUGIN_API !== PLUGIN_API)
        throw new Error(`plugin API ${module.PLUGIN_API}`);
      rules = { ...module, version: plugin.version };
      listeners.forEach((listener) => listener());
    } catch (error) {
      console.error("kingdom plugin rules", error);
    }
    return rules;
  });
  return loadingRules;
}

let loadingUi: Promise<{ ui: KingdomUi; plugin: LivePlugin } | null> | null =
  null;

/** Loads the live plugin's pages and their styles, or null if it can't. */
export function loadKingdomUi() {
  loadingUi ??= livePlugin().then(async (plugin) => {
    if (!plugin) return null;
    try {
      const ui = (await importUrl(plugin.ui)) as KingdomUi;
      if (typeof ui.mountKingdomPage !== "function")
        throw new Error("no mountKingdomPage");
      if (
        !document.querySelector(`link[data-kingdom-css="${plugin.version}"]`)
      ) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = plugin.css;
        link.dataset.kingdomCss = plugin.version;
        document.head.appendChild(link);
      }
      return { ui, plugin };
    } catch (error) {
      console.error("kingdom plugin UI", error);
      return null;
    }
  });
  return loadingUi;
}

/** Forgets what was loaded, for tests. */
export function resetKingdomPlugin() {
  live = loadingRules = loadingUi = null;
  rules = null;
  listeners.forEach((listener) => listener());
}
