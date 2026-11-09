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
      title: "dingn — Games & Adventures",
      description:
        "Discover games on dingn, home of Memory Ladder: quick memory, logic and decision challenges and the 3D Crowd Rush.",
    },
    zh: {
      title: "dingn — 游戏与冒险",
      description:
        "探索 dingn 游戏平台，畅玩记忆阶梯：快速的记忆、逻辑与决策挑战，还有 3D 人潮突击。",
    },
  },
  "/memory-ladder/": {
    index: true,
    en: {
      title: "Memory Ladder",
      description:
        "Catch a sequence of digits, hold it in your head and climb up to 20 digits with three lives.",
    },
    zh: {
      title: "记忆阶梯",
      description: "记住一串数字，在脑中保持住，带着三条命一路爬到 20 位。",
    },
  },
  "/logic/": {
    index: true,
    en: {
      title: "Logic lab",
      description:
        "Connect the clues and put your reasoning to work in four quick logic puzzles.",
    },
    zh: {
      title: "逻辑实验室",
      description: "串起线索，在四道快速逻辑题中检验你的推理能力。",
    },
  },
  "/decisions/": {
    index: true,
    en: {
      title: "Decision room",
      description:
        "Weigh the odds, work with a budget, and discover why the goal matters.",
    },
    zh: {
      title: "决策室",
      description: "权衡概率、管好预算，发现目标为什么重要。",
    },
  },
  "/crowd/": {
    index: true,
    en: {
      title: "Crowd Rush",
      description:
        "A 3D crowd runner: grow your squad through number gates, blast crates and monsters, and take down the boss at the end of every level.",
    },
    zh: {
      title: "人潮突击",
      description:
        "3D 人潮跑酷：穿过数字门壮大队伍，击碎箱子和怪物，在每关结尾打败首领。",
    },
  },
  "/number/": {
    index: true,
    en: {
      title: "Numbers",
      description:
        "Practise the Major System: turn numbers into sounds, words and pictures you can remember.",
    },
    zh: {
      title: "数字实验室",
      description: "练习数字记忆法：把数字变成容易记住的声音、单词和画面。",
    },
  },
  "/word/": {
    index: true,
    en: {
      title: "Words",
      description:
        "Explore the Major System word universe and link words back to the numbers they encode.",
    },
    zh: {
      title: "单词世界",
      description: "探索数字记忆法的单词世界，把单词和它们代表的数字联系起来。",
    },
  },
  "/card/": {
    index: true,
    en: {
      title: "Playing cards",
      description:
        "Memorise a deck of playing cards with images from the Major System.",
    },
    zh: {
      title: "扑克牌练习",
      description: "借助数字记忆法的图像，记住一整副扑克牌。",
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
    index: true,
    en: { title: "Sign in" },
    zh: { title: "登录" },
  },
  "/account/": {
    index: true,
    en: { title: "Your account" },
    zh: { title: "我的账号" },
  },
  "/opt-out/": {
    index: true,
    en: { title: "Analytics opt-out" },
    zh: { title: "关闭访问统计" },
  },
  "/admin/feedback/": {
    index: false,
    en: { title: "Feedback inbox" },
    zh: { title: "反馈收件箱" },
  },
  "/pop/": {
    index: false,
    en: { title: "Crowd Rush" },
    zh: { title: "人潮突击" },
  },
} satisfies Record<string, Page>;

export type PagePath = keyof typeof pages;
/** Only these pages go in the sitemap; sign-in and account pages stay out of it. */
export const sitemapPaths: PagePath[] = [
  "/",
  "/memory-ladder/",
  "/logic/",
  "/decisions/",
  "/crowd/",
  "/number/",
  "/word/",
  "/card/",
  "/feedback/",
];

/** Absolute URLs of one page in every language, for hreflang alternates. */
export function alternates(path: PagePath) {
  return {
    en: siteUrl + localePath(path, "en"),
    "zh-CN": siteUrl + localePath(path, "zh-CN"),
    "x-default": siteUrl + localePath(path, "en"),
  };
}

/** Title, description, canonical URL and hreflang alternates for a page. */
export function pageMetadata(path: PagePath, locale: Locale): Metadata {
  const page: Page = pages[path];
  const copy = locale === "zh-CN" ? page.zh : page.en;
  const url = siteUrl + localePath(path, locale);
  return {
    title: path === "/" ? { absolute: copy.title } : copy.title,
    ...(copy.description ? { description: copy.description } : {}),
    alternates: { canonical: url, languages: alternates(path) },
    openGraph: {
      url,
      title: copy.title,
      ...(copy.description ? { description: copy.description } : {}),
      siteName: "dingn",
      locale: locale === "zh-CN" ? "zh_CN" : "en_US",
      alternateLocale: locale === "zh-CN" ? "en_US" : "zh_CN",
      type: "website",
    },
    ...(page.index ? {} : { robots: { index: false, follow: false } }),
  };
}
