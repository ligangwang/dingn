"use client";
import { useLocale } from "@/components/locale";
import Link from "next/link";
import { Leaderboard } from "@/components/xp";
import { CATEGORY_INFO, TopGames, useCatalog } from "@/components/catalog";
import type { Category } from "@/lib/catalog";

/** The home page's category cards, in menu order. */
const ARENAS: {
  category: Category;
  className: string;
  eyebrow: string;
  title: string;
  text: string;
}[] = [
  {
    category: "casual",
    className: "crowd-arena",
    eyebrow: "01 / CASUAL",
    title: "Pick up and play.",
    text: "Quick, bright games you can jump into any time and put down just as fast.",
  },
  {
    category: "memory",
    className: "memory-arena",
    eyebrow: "02 / MEMORY",
    title: "Make it stick.",
    text: "Catch a string of digits or a whole shuffled deck. Hold it in your head. Recall it before it slips away.",
  },
  {
    category: "puzzle",
    className: "puzzle-arena",
    eyebrow: "03 / PUZZLE",
    title: "Twist it back.",
    text: "Scramble the cube, then turn it face by face until every side is one color again.",
  },
];

export function Home() {
  const { t, href } = useLocale();
  const catalog = useCatalog();

  return (
    <div className="mind-home container">
      <section className="mind-hero">
        <div>
          <p className="eyebrow">{t("THE DINGN GAME PLATFORM")}</p>
          <h1>
            {t("Your next adventure.")}
            <br />
            <span>{t("Starts here.")}</span>
          </h1>
          <p className="lede">
            {t("Quick challenges today. New worlds to explore tomorrow.")}
            <br />
            {t("One platform. Your own way to play.")}
          </p>
          <a className="button" href="#games">
            {t("Find your next game ↗")}
          </a>
          <p className="hero-caption">
            {t("Short rounds. Fresh perspectives. Your pace.")}
          </p>
        </div>
        <div className="mind-art" aria-hidden="true">
          <span className="orbit-label">{t("THINK / PLAY / REPEAT")}</span>
          <img src="/dingn-mark.svg" alt="" />
          <span className="art-chip chip-one">32 → ☾</span>
          <span className="art-chip chip-two">{t("WHAT’S NEXT?")}</span>
          <span className="art-chip chip-three">{t("YOUR MOVE ↗")}</span>
        </div>
      </section>
      <section id="games">
        <div className="mind-heading">
          <div>
            <p className="eyebrow">{t("THREE WAYS TO PLAY")}</p>
            <h2>{t("Your mind. Your playground.")}</h2>
          </div>
        </div>
        <div className="arena-grid">
          {ARENAS.map(({ category, className, eyebrow, title, text }) => {
            const { path, Icon, label } = CATEGORY_INFO[category];
            return (
              <div key={category} className={`arena ${className}`}>
                <Link href={href(path)} className="arena-link">
                  <Icon className="arena-symbol" size={52} />
                  <p className="eyebrow">{t(eyebrow)}</p>
                  <h2>{t(title)}</h2>
                  <p>{t(text)}</p>
                  <strong>{t(`See all ${label.toLowerCase()} games →`)}</strong>
                </Link>
                <TopGames games={catalog} category={category} />
              </div>
            );
          })}
        </div>
      </section>
      <Leaderboard />
      <section className="memory-library">
        <p className="eyebrow">{t("PRACTICE, NO SCORE")}</p>
        <h2>{t("Build connections that stick.")}</h2>
        <p>
          {t(
            "Learn the Major System at your own pace: turn numbers into sounds, words, and pictures you can remember.",
          )}
        </p>
        <div className="library-links">
          <Link href={href("/play/memory/#number")}>
            {t("Number practice ↗")}
          </Link>
          <Link href={href("/play/memory/#word")}>{t("Word practice ↗")}</Link>
          <Link href={href("/play/memory/#card")}>{t("Card practice ↗")}</Link>
        </div>
      </section>
      <p className="support">
        <Link href={href("/feedback/")}>
          {t("Have a game idea? Help shape dingn ↗")}
        </Link>
      </p>
    </div>
  );
}
