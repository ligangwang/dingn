"use client";
import { pick } from "@/lib/i18n";
import { useLocale } from "@/components/locale";
import Link from "next/link";
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
import { useKingdomRules } from "@/lib/reward-plugin";
import { fetchKingdom, type KingdomView } from "@/lib/kingdom";

/** The home page's category cards, in menu order. */
const ARENAS: { category: Category; className: string }[] = [
  { category: "casual", className: "crowd-arena" },
  { category: "memory", className: "memory-arena" },
  { category: "puzzle", className: "puzzle-arena" },
  { category: "adventure", className: "adventure-arena" },
];

export function Home() {
  const { t, href } = useLocale();
  const catalog = useCatalog();

  return (
    <div className="mind-home container">
      <section className="mind-hero">
        <div>
          <h1>
            {t("Quick games.")}
            <br />
            <span>{t("One growing kingdom.")}</span>
          </h1>
          <p className="lede">
            {t("Play a round, earn coins, and build your world.")}
          </p>
          <div className="hero-actions">
            <a className="button" href="#games">
              {t("Play a game")}
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
          <h2>{t("Games")}</h2>
        </div>
        <div className="arena-grid">
          {ARENAS.map(({ category, className }) => {
            const { path, Icon, label, tagline } = CATEGORY_INFO[category];
            return (
              <div key={category} className={`arena ${className}`}>
                <Link href={href(path)} className="arena-link">
                  <Icon className="arena-symbol" size={52} />
                  <h2>{t(`${label} games`)}</h2>
                  <p>{t(tagline)}</p>
                </Link>
                <TopGames games={catalog} category={category} />
              </div>
            );
          })}
        </div>
      </section>
      <section className="memory-library">
        <h2>{t("Memory practice")}</h2>
        <p>
          {t(
            "Learn the Major System: turn numbers into words and pictures you can remember. No score.",
          )}
        </p>
        <div className="library-links">
          <Link href={href("/play/memory/#number")}>
            {t("Number practice")}
          </Link>
          <Link href={href("/play/memory/#word")}>{t("Word practice")}</Link>
          <Link href={href("/play/memory/#card")}>{t("Card practice")}</Link>
        </div>
      </section>
      <p className="support">
        <Link href={href("/feedback/")}>
          {t("Have a game idea? Help shape dingn.")}
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
  const [fetched, setView] = useState<KingdomView | null>(null);
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
  const rules = useKingdomRules();
  // The card needs the kingdom's rules; without them it invites, as signed out.
  const view = rules ? fetched : null;
  const {
    kingdom: { STAGES },
    levels: { xpToReach },
  } = rules ?? { kingdom: { STAGES: [] }, levels: { xpToReach: () => 0 } };
  const name = (title: { en: string; zh: string }) => pick(title, locale, true);
  const stage = STAGES.find((s) => s.id === view?.stage);
  const next = STAGES.find((s) => s.level > (view?.level ?? 0));
  const toGo = view && next ? Math.max(0, xpToReach(next.level) - view.xp) : 0;
  const from = stage ? xpToReach(stage.level) : 0;
  const share =
    view && next
      ? Math.min(
          1,
          Math.max(0, (view.xp - from) / (xpToReach(next.level) - from)),
        )
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
          </>
        ) : (
          <>
            <p className="eyebrow">{t("FROM CAMP TO CAPITAL")}</p>
            <ol className="hero-stages" aria-label={t("Kingdom stages")}>
              {STAGES.map((s) => (
                <li key={s.id}>{name(s.title)}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
