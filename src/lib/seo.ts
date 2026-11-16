import type { Metadata } from "next";
import { localePath, type Locale } from "./i18n";

export const siteUrl = "https://dingn.com";
export const locales: Locale[] = ["en", "zh-CN"];

type Copy = { title: string; description?: string };
type Page = {
  en: Copy;
  zh: Copy;
  /** Listed in the sitemap and open to search engines. */
  index: boolean;
};

/** Every page, by its language-neutral path. Chinese copies live under /zh/. */
export const pages = {
  "/": {
    index: true,
    en: {
      title: "dingn — Free online games & adventures",
      description:
        "Play free games in your browser on dingn: the 3D Crowd Rush runner, Gem Surge match-3, Pawpal, a 3D Rubik's Cube and memory challenges. No download.",
    },
    zh: {
      title: "dingn — 免费在线游戏与冒险",
      description:
        "在 dingn 打开浏览器就能免费玩：3D 跑酷人潮突击、宝石狂潮三消、萌宠伙伴、3D 魔方和记忆挑战，无需下载。",
    },
  },
  "/casual/": {
    index: true,
    en: {
      title: "Free casual games online",
      description:
        "Quick, bright games to pick up any time: play Crowd Rush, Gem Surge, Pawpal and more free casual games in your browser on dingn.",
    },
    zh: {
      title: "免费在线休闲游戏",
      description:
        "随时上手的轻松小游戏：在 dingn 打开浏览器免费畅玩人潮突击、宝石狂潮、萌宠伙伴等休闲游戏。",
    },
  },
  "/memory/": {
    index: true,
    en: {
      title: "Free memory games online",
      description:
        "Train your memory for free in your browser: Number Ladder, Card Ladder and Major System practice on dingn.",
    },
    zh: {
      title: "免费在线记忆游戏",
      description:
        "在 dingn 免费在线训练记忆力：数字阶梯、扑克牌阶梯和主要记忆法练习。",
    },
  },
  "/puzzle/": {
    index: true,
    en: {
      title: "Free puzzle games online",
      description:
        "Twist, turn and think your way through free puzzle games in your browser on dingn, like the 3D Rubik's Cube with a step-by-step solver.",
    },
    zh: {
      title: "免费在线益智游戏",
      description:
        "在 dingn 打开浏览器免费玩 3D 魔方等益智游戏，转一转、想一想，还有分步解法。",
    },
  },
  "/feedback/": {
    index: true,
    en: {
      title: "Share feedback",
      description: "Have a game idea? Help shape dingn.",
    },
    zh: {
      title: "分享反馈",
      description: "有游戏点子？一起打造 dingn。",
    },
  },
  "/signin/": {
    // Nothing for a search engine to show: kept out of results.
    index: false,
    en: { title: "Sign in" },
    zh: { title: "登录" },
  },
  "/account/": {
    index: false,
    en: { title: "Your account" },
    zh: { title: "我的账号" },
  },
  "/coins/": {
    index: true,
    en: {
      title: "Coin shop",
      description: "Get coin packs to spend on upgrades in dingn games.",
    },
    zh: {
      title: "金币商店",
      description: "购买金币包，用于 dingn 游戏中的升级。",
    },
  },
  "/kingdom/": {
    index: true,
    en: {
      title: "Your kingdom",
      description:
        "Grow a 3D kingdom with the XP and coins you earn in dingn games.",
    },
    zh: {
      title: "我的王国",
      description: "用在 dingn 游戏中赢得的经验和金币，建造一座 3D 王国。",
    },
  },
  "/terms/": {
    index: true,
    en: {
      title: "Terms of use",
      description:
        "The rules for using dingn, including coin purchases and refunds.",
    },
    zh: {
      title: "使用条款",
      description: "使用 dingn 的规则，包括购买金币和退款。",
    },
  },
  "/privacy/": {
    index: true,
    en: {
      title: "Privacy policy",
      description: "What dingn keeps about you, why, and your choices.",
    },
    zh: {
      title: "隐私政策",
      description: "dingn 保存哪些关于你的信息、原因，以及你的选择。",
    },
  },
  "/opt-out/": {
    index: true,
    en: { title: "Analytics opt-out" },
    zh: { title: "关闭访问统计" },
  },
  "/play/": {
    // Every published game plays here, at /play/<id>/.
    index: false,
    en: { title: "Play" },
    zh: { title: "开始游戏" },
  },
  "/developers/": {
    index: true,
    en: {
      title: "Make a game for dingn",
      description:
        "Build a web game for dingn with the dingn game SDK: the starter game, the SDK reference and a playground to test your game.",
    },
    zh: {
      title: "为 dingn 制作游戏",
      description:
        "用 dingn 游戏 SDK 为 dingn 制作网页游戏：入门游戏、SDK 参考和测试游戏的试玩场。",
    },
  },
  "/developers/agreement/": {
    index: true,
    en: {
      title: "Developer agreement",
      description:
        "The terms for publishing a game on dingn: your rights, what games must not do, review and removal.",
    },
    zh: {
      title: "开发者协议",
      description:
        "在 dingn 发布游戏的条款：你的权利、游戏不得做的事、审核与下架。",
    },
  },
  "/developers/games/": {
    index: false,
    en: { title: "My games" },
    zh: { title: "我的游戏" },
  },
  "/developers/playground/": {
    index: false,
    en: { title: "Game playground" },
    zh: { title: "游戏试玩场" },
  },
  "/admin/games/": {
    index: false,
    en: { title: "Games admin" },
    zh: { title: "游戏管理" },
  },
  "/admin/users/": {
    index: false,
    en: { title: "Users admin" },
    zh: { title: "用户管理" },
  },
  "/admin/players/": {
    index: false,
    en: { title: "Players admin" },
    zh: { title: "玩家管理" },
  },
  "/admin/feedback/": {
    index: false,
    en: { title: "Feedback inbox" },
    zh: { title: "反馈收件箱" },
  },
} satisfies Record<string, Page>;

export type PagePath = keyof typeof pages;
/** Only these pages go in the sitemap; sign-in and account pages stay out of it. */
export const sitemapPaths: PagePath[] = [
  "/",
  "/casual/",
  "/memory/",
  "/puzzle/",
  "/feedback/",
  "/kingdom/",
  "/coins/",
  "/developers/",
  "/developers/agreement/",
];

/** Absolute URLs of one page in every language, for hreflang alternates. */
export function alternates(path: PagePath) {
  return {
    en: siteUrl + localePath(path, "en"),
    "zh-CN": siteUrl + localePath(path, "zh-CN"),
    "x-default": siteUrl + localePath(path, "en"),
  };
}

/**
 * The picture link previews show (1200×630), in each language. A game's page
 * swaps in the game's own cover (scripts/game-seo.mjs).
 */
export const shareImage = (locale: Locale) => ({
  url: siteUrl + (locale === "zh-CN" ? "/og-zh.jpg" : "/og.jpg"),
  width: 1200,
  height: 630,
  alt:
    locale === "zh-CN"
      ? "dingn：打开浏览器就能玩的免费游戏"
      : "dingn: free games to play in your browser",
});

/** Title, description, canonical URL, hreflang and share card for a page. */
export function pageMetadata(path: PagePath, locale: Locale): Metadata {
  const page: Page = pages[path];
  const copy = locale === "zh-CN" ? page.zh : page.en;
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
      locale: locale === "zh-CN" ? "zh_CN" : "en_US",
      alternateLocale: locale === "zh-CN" ? "en_US" : "zh_CN",
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
        description: (locale === "zh-CN" ? pages["/"].zh : pages["/"].en)
          .description,
        publisher: { "@id": siteUrl + "/#organization" },
      },
    ],
  };
}
