"use client";
import { pick } from "@/lib/i18n";
import { useLocale } from "@/components/locale";
import Link from "next/link";
import { Leaderboard } from "@/components/xp";
import {
  CATEGORY_INFO,
  GameCover,
  TopGames,
  playPath,
  useCatalog,
} from "@/components/catalog";
import { homeGame, type CatalogGame, type Category } from "@/lib/catalog";
import { useEffect, useState } from "react";
import { useOptionalSession } from "@/components/session";
import { STAGES } from "@/data/kingdom.mjs";
import { fetchKingdom, type KingdomView } from "@/lib/kingdom";

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
  {
    category: "adventure",
    className: "adventure-arena",
    eyebrow: "04 / ADVENTURE",
    title: "Find them all.",
    text: "Set out across mythic realms, bind the spirits you meet and fill your codex page by page.",
  },
];

export function Home() {
  const { t, href } = useLocale();
  const catalog = useCatalog();

  return (
    <div className="mind-home container">
      <section className="mind-hero">
        <div>
          <p className="eyebrow">{t("PLAY · EARN · BUILD")}</p>
          <h1>
            {t("Quick games.")}
            <br />
            <span>{t("One growing kingdom.")}</span>
          </h1>
          <p className="lede">
            {t("Play a round, earn coins, and build your world.")}
            <br />
            {t("Every dingn game pays into the same kingdom.")}
          </p>
          <div className="hero-actions">
            <a className="button" href="#games">
              {t("Play a game ↗")}
            </a>
            <Link className="secondary-button" href={href("/kingdom/")}>
              {t("See the kingdom →")}
            </Link>
          </div>
        </div>
        <HeroKingdom />
      </section>
      {catalog && <FeaturedGame games={catalog} />}
      <section id="games">
        <div className="mind-heading">
          <div>
            <p className="eyebrow">{t("FOUR WAYS TO PLAY")}</p>
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

/**
 * The game the home page features, in a banner under the hero: the one an
 * admin picked for the home page, otherwise the newest or most played.
 */
function FeaturedGame({ games }: { games: CatalogGame[] }) {
  const { t, locale, href } = useLocale();
  const game = homeGame(games);
  if (!game) return null;
  const title = pick(game.title, locale);
  return (
    <section className="home-featured" aria-label={t("FEATURED")}>
      <Link className="featured-game" href={href(playPath(game.id))}>
        <GameCover game={game} title={title} size={200} play="view" />
        <span className="featured-copy">
          <span className="eyebrow">{t("FEATURED")}</span>
          <strong>{title}</strong>
          <span>{pick(game.description, locale)}</span>
          <span className="button">{t("Play")}</span>
        </span>
      </Link>
    </section>
  );
}

/**
 * The hero's picture: a grown kingdom, with the player's own progress on it.
 * Signed out, it shows the road from camp to capital instead.
 */
function HeroKingdom() {
  const { t, locale, href } = useLocale();
  const session = useOptionalSession();
  const signedIn = !!session?.user;
  const [view, setView] = useState<KingdomView | null>(null);
  useEffect(() => {
    if (!signedIn) return setView(null);
    let current = true;
    fetchKingdom()
      .then((v) => current && setView(v))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [signedIn]);
  const name = (title: { en: string; zh: string }) => pick(title, locale, true);
  const stage = STAGES.find((s) => s.id === view?.stage);
  const next = STAGES.find((s) => s.level > (view?.level ?? 0));
  // XP needed for a level, as src/components/kingdom-card.tsx.
  const xpFor = (level: number) => 50 * level * (level - 1);
  const toGo = view && next ? Math.max(0, xpFor(next.level) - view.xp) : 0;
  const from = stage ? xpFor(stage.level) : 0;
  const share =
    view && next
      ? Math.min(1, Math.max(0, (view.xp - from) / (xpFor(next.level) - from)))
      : 1;
  return (
    <div className="hero-kingdom">
      <img
        src="/home/kingdom-capital.jpg"
        alt={t(
          "A walled capital on a green island by the sea, grown in the dingn kingdom",
        )}
        width={960}
        height={541}
        fetchPriority="high"
      />
      <div className="hero-kingdom-card">
        {view ? (
          <>
            <p className="eyebrow">{t("YOUR KINGDOM")}</p>
            <strong>
              {stage
                ? t(`${name(stage.title)} · account level ${view.level}`)
                : t(`Account level ${view.level}`)}
            </strong>
            {next ? (
              <>
                <span
                  className="hero-kingdom-bar"
                  role="progressbar"
                  aria-label={t(
                    `Progress to ${name(next.title).toLowerCase()}`,
                  )}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(share * 100)}
                >
                  <span style={{ width: `${share * 100}%` }} />
                </span>
                <span>
                  {t(
                    `${toGo.toLocaleString(locale)} XP to a ${name(next.title).toLowerCase()}`,
                  )}
                </span>
              </>
            ) : (
              <span>{t("Your capital is complete.")}</span>
            )}
            <Link href={href("/kingdom/")}>{t("Build with your coins →")}</Link>
          </>
        ) : (
          <>
            <p className="eyebrow">{t("FROM CAMP TO CAPITAL")}</p>
            <ol className="hero-stages" aria-label={t("Kingdom stages")}>
              {STAGES.map((s) => (
                <li key={s.id}>{name(s.title)}</li>
              ))}
            </ol>
            <span>
              {t(
                "Earn XP and coins in any dingn game, then grow a camp into a capital.",
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
