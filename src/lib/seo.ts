import type { Metadata } from "next";
import { LOCALES, localeInfo, localePath, type Locale } from "./i18n";
import { translateServer } from "./packs.server";

export const siteUrl = "https://dingn.com";
/** Every language, English first (one per pack in locales/). */
export const locales: Locale[] = LOCALES.map((l) => l.lang);

type Copy = { title: string; description?: string };
type Page = {
  /** In English; other languages translate it with their pack. */
  en: Copy;
  /** Listed in the sitemap and open to search engines. */
  index: boolean;
};

/** Every page, by its language-neutral path. Other languages live under their prefix. */
export const pages = {
  "/": {
    index: true,
    en: {
      title: "dingn — Free online games & adventures",
      description:
        "Play free games in your browser on dingn: the 3D Crowd Rush runner, Gem Surge match-3, Pawpal, a 3D Rubik's Cube and memory challenges. No download.",
    },
  },
  "/casual/": {
    index: true,
    en: {
      title: "Free casual games online",
      description:
        "Quick, bright games to pick up any time: play Crowd Rush, Gem Surge, Pawpal and more free casual games in your browser on dingn.",
    },
  },
  "/memory/": {
    index: true,
    en: {
      title: "Free memory games online",
      description:
        "Train your memory for free in your browser: Number Ladder, Card Ladder and Major System practice on dingn.",
    },
  },
  "/puzzle/": {
    index: true,
    en: {
      title: "Free puzzle games online",
      description:
        "Twist, turn and think your way through free puzzle games in your browser on dingn, like the 3D Rubik's Cube with a step-by-step solver.",
    },
  },
  "/adventure/": {
    index: true,
    en: {
      title: "Free adventure games online",
      description:
        "Explore new worlds for free in your browser on dingn: adventure games like Mythbound, where you bind mythical spirits and fill your codex.",
    },
  },
  "/feedback/": {
    index: true,
    en: {
      title: "Share feedback",
      description: "Have a game idea? Help shape dingn.",
    },
  },
  "/signin/": {
    // Nothing for a search engine to show: kept out of results.
    index: false,
    en: { title: "Sign in" },
  },
  "/leaderboard/": {
    // Admins only for now (Players admin page makes it public).
    index: false,
    en: { title: "Leaderboard" },
  },
  "/account/": {
    index: false,
    en: { title: "Your account" },
  },
  "/player/": {
    // Every player's public page, at /player/<number>/: kept out of results.
    index: false,
    en: { title: "Player" },
  },
  "/coins/": {
    index: true,
    en: {
      title: "Coin shop",
      description: "Get coin packs to spend on upgrades in dingn games.",
    },
  },
  "/kingdom/": {
    index: true,
    en: {
      title: "Your kingdom",
      description:
        "Grow a 3D kingdom with the XP and coins you earn in dingn games.",
    },
  },
  "/terms/": {
    index: true,
    en: {
      title: "Terms of use",
      description:
        "The rules for using dingn, including coin purchases and refunds.",
    },
  },
  "/privacy/": {
    index: true,
    en: {
      title: "Privacy policy",
      description: "What dingn keeps about you, why, and your choices.",
    },
  },
  "/opt-out/": {
    index: true,
    en: { title: "Analytics opt-out" },
  },
  "/play/": {
    // Every published game plays here, at /play/<id>/.
    index: false,
    en: { title: "Play" },
  },
  "/developers/": {
    index: true,
    en: {
      title: "Make a game for dingn",
      description:
        "Build a web game for dingn with the dingn game SDK: the starter game, the SDK reference and a playground to test your game.",
    },
  },
  "/developers/agreement/": {
    index: true,
    en: {
      title: "Developer agreement",
      description:
        "The terms for publishing a game on dingn: your rights, what games must not do, review and removal.",
    },
  },
  "/developers/games/": {
    index: false,
    en: { title: "My games" },
  },
  "/developers/playground/": {
    index: false,
    en: { title: "Game playground" },
  },
  "/admin/games/": {
    index: false,
    en: { title: "Games admin" },
  },
  "/admin/users/": {
    index: false,
    en: { title: "Users admin" },
  },
  "/admin/players/": {
    index: false,
    en: { title: "Players admin" },
  },
  "/admin/funnel/": {
    index: false,
    en: { title: "Funnel admin" },
  },
  "/admin/feedback/": {
    index: false,
    en: { title: "Feedback inbox" },
  },
} satisfies Record<string, Page>;

export type PagePath = keyof typeof pages;
/** Only these pages go in the sitemap; sign-in and account pages stay out of it. */
export const sitemapPaths: PagePath[] = [
  "/",
  "/casual/",
  "/memory/",
  "/puzzle/",
  "/adventure/",
  "/feedback/",
  "/kingdom/",
  "/coins/",
  "/developers/",
  "/developers/agreement/",
];

/** Absolute URLs of one page in every language, for hreflang alternates. */
export function alternates(path: PagePath): Record<string, string> {
  return {
    ...Object.fromEntries(
      locales.map((locale) => [locale, siteUrl + localePath(path, locale)]),
    ),
    "x-default": siteUrl + localePath(path, "en"),
  };
}

/** A page's title and description in a language. */
function copyOf(path: PagePath, locale: Locale): Copy {
  const { title, description } = (pages[path] as Page).en;
  return {
    title: translateServer(title, locale),
    ...(description
      ? { description: translateServer(description, locale) }
      : {}),
  };
}

/**
 * The picture link previews show (1200×630), in each language. A game's page
 * swaps in the game's own cover (scripts/game-seo.mjs).
 */
export const shareImage = (locale: Locale) => ({
  // The picture has words on it: Chinese has its own, others use English's.
  url: siteUrl + (locale === "zh-CN" ? "/og-zh.jpg" : "/og.jpg"),
  width: 1200,
  height: 630,
  alt: translateServer("dingn: free games to play in your browser", locale),
});

/** Title, description, canonical URL, hreflang and share card for a page. */
export function pageMetadata(path: PagePath, locale: Locale): Metadata {
  const page: Page = pages[path];
  const copy = copyOf(path, locale);
  const url = siteUrl + localePath(path, locale);
  const image = shareImage(locale);
  const description = copy.description ? { description: copy.description } : {};
  return {
    title: path === "/" ? { absolute: copy.title } : copy.title,
    ...description,
    alternates: { canonical: url, languages: alternates(path) },
    openGraph: {
      url,
      title: copy.title,
      ...description,
      siteName: "dingn",
      locale: localeInfo(locale).og,
      alternateLocale: LOCALES.filter((l) => l.lang !== locale).map(
        (l) => l.og,
      ),
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      ...description,
      images: [image.url],
    },
    ...(page.index ? {} : { robots: { index: false, follow: false } }),
  };
}

/** The site and its publisher, for search engines (schema.org JSON-LD). */
export function siteJsonLd(locale: Locale) {
  const home = siteUrl + localePath("/", locale);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": siteUrl + "/#organization",
        name: "dingn",
        url: siteUrl + "/",
        logo: siteUrl + "/dingn-mark.svg",
      },
      {
        "@type": "WebSite",
        "@id": home + "#website",
        name: "dingn",
        url: home,
        inLanguage: locale,
        description: copyOf("/", locale).description,
        publisher: { "@id": siteUrl + "/#organization" },
      },
    ],
  };
}
