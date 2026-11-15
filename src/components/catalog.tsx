"use client";
// The category pages (/casual/, /memory/, /puzzle/), the menu's game lists
// and the home page's thumbnails, all filled from the catalog
// (src/lib/catalog.ts): whatever games are listed and approved.
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useLocale } from "./locale";
import { useOptionalSession } from "./session";
import { useWallet } from "./rewards";
import { CrowdIcon, MemoryIcon, PuzzleIcon } from "./icons";
import { database, doc, getDoc } from "@/lib/database";
import {
  featuredGame,
  pinnedGame,
  gamesIn,
  loadCatalog,
  playerProgress,
  sortGames,
  tagOf,
  type CatalogGame,
  type Category,
  type GameProgress,
  type Sort,
} from "@/lib/catalog";

type IconType = ComponentType<{ size?: number; className?: string }>;

/** Each category's menu label, page and copy. */
export const CATEGORY_INFO: Record<
  Category,
  { label: string; path: string; Icon: IconType; tagline: string }
> = {
  casual: {
    label: "Casual",
    path: "/casual/",
    Icon: CrowdIcon,
    tagline: "Quick, bright games to pick up any time.",
  },
  memory: {
    label: "Memory",
    path: "/memory/",
    Icon: MemoryIcon,
    tagline: "Train your memory one rung at a time.",
  },
  puzzle: {
    label: "Puzzle",
    path: "/puzzle/",
    Icon: PuzzleIcon,
    tagline: "Twist, turn and think your way through.",
  },
};

export const playPath = (id: string) => `/play/${id}/`;

/** The catalog; null while it loads. */
export function useCatalog() {
  const [games, setGames] = useState<CatalogGame[] | null>(null);
  useEffect(() => {
    let active = true;
    void loadCatalog().then((list) => active && setGames(list));
    return () => {
      active = false;
    };
  }, []);
  return games;
}

/** What the signed-in player has done in each game; {} when signed out. */
export function usePlayerProgress(): Record<string, GameProgress> {
  const uid = useOptionalSession()?.user?.uid ?? "";
  const wallet = useWallet();
  const [account, setAccount] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    setAccount(null);
    if (!uid) return;
    let active = true;
    getDoc(doc(database, "accounts", uid))
      .then((snap) => active && setAccount(snap.data()))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [uid]);
  return useMemo(
    () => (uid ? playerProgress(wallet, account) : {}),
    [uid, wallet, account],
  );
}

const lang = (locale: string) => (locale === "zh-CN" ? "zh" : "en");

/** A small whole number from a game id, to vary the drawn covers. */
function hue(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** The game's cover picture, or drawn art in the category's style. */
export function GameCover({
  game,
  title,
  size = 120,
}: {
  game: CatalogGame;
  title: string;
  size?: number;
}) {
  const { Icon } = CATEGORY_INFO[game.category];
  if (game.cover)
    return (
      <span className="game-cover">
        <img src={game.cover} alt="" loading="lazy" />
      </span>
    );
  const h = hue(game.id);
  return (
    <span
      className="game-cover drawn"
      style={{
        background: `radial-gradient(circle at 78% 18%, hsl(${(h + 40) % 360} 85% 62% / 0.55), transparent 45%), linear-gradient(150deg, hsl(${h} 55% 30%), hsl(${(h + 300) % 360} 45% 14%))`,
      }}
    >
      <Icon className="cover-icon" size={size} />
      <span className="cover-title">{title}</span>
    </span>
  );
}

function ProgressLine({ progress }: { progress?: GameProgress }) {
  const { t } = useLocale();
  if (!progress) return null;
  const parts = [
    progress.level ? t(`Level ${progress.level}`) : null,
    progress.badges
      ? t(progress.badges === 1 ? "1 badge" : `${progress.badges} badges`)
      : null,
  ].filter(Boolean);
  return (
    <span className="game-progress">
      {parts.length ? parts.join(" · ") : t("Started")}
    </span>
  );
}

export function GameCard({
  game,
  tag,
  progress,
}: {
  game: CatalogGame;
  tag: "new" | "hot" | null;
  progress?: GameProgress;
}) {
  const { t, locale, href } = useLocale();
  const l = lang(locale);
  const title = game.title[l] || game.title.en;
  return (
    <Link className="game-card" href={href(playPath(game.id))}>
      <GameCover game={game} title={title} />
      {tag && (
        <span className={`game-tag tag-${tag}`}>
          {tag === "new" ? t("New") : t("Hot")}
        </span>
      )}
      <span className="game-card-body">
        <strong>{title}</strong>
        <span className="game-pitch">
          {game.description[l] || game.description.en}
        </span>
        <ProgressLine progress={progress} />
      </span>
    </Link>
  );
}

const SORTS: [Sort, string][] = [
  ["popular", "Popular"],
  ["new", "New"],
  ["az", "A–Z"],
];

/** A category's page: banner, games in progress, and every game in a grid. */
export function CategoryPage({ category }: { category: Category }) {
  const { t, locale, href } = useLocale();
  const l = lang(locale);
  const info = CATEGORY_INFO[category];
  const catalog = useCatalog();
  const progress = usePlayerProgress();
  const [sort, setSort] = useState<Sort>("popular");
  const games = useMemo(
    () => (catalog ? gamesIn(catalog, category, l) : null),
    [catalog, category, l],
  );
  // One game needs no banner, unless an admin pinned it there.
  const featured =
    games && (games.length > 1 || pinnedGame(games))
      ? featuredGame(games)
      : null;
  const started = (games ?? [])
    .filter((g) => progress[g.id])
    .sort((a, b) =>
      (progress[b.id].lastAt ?? "").localeCompare(progress[a.id].lastAt ?? ""),
    );
  const count = games?.length ?? 0;
  return (
    <div className={`category-page container category-${category}`}>
      <header className="category-head">
        <info.Icon className="category-symbol" size={44} />
        <div>
          <p className="eyebrow">{t("GAMES")}</p>
          <h1>{t(`${info.label} games`)}</h1>
          <p className="lede">{t(info.tagline)}</p>
        </div>
        {games && (
          <span className="category-count">
            {t(count === 1 ? "1 game" : `${count} games`)}
          </span>
        )}
      </header>

      {!games && <p className="category-loading">{t("Loading games…")}</p>}

      {games && !games.length && (
        <div className="category-empty">
          <p>
            {t(
              "No games here yet. New games appear as soon as they're approved.",
            )}
          </p>
          <Link href={href("/developers/")}>
            {t("Make a game for dingn ↗")}
          </Link>
        </div>
      )}

      {featured && (
        <Link className="featured-game" href={href(playPath(featured.id))}>
          <GameCover
            game={featured}
            title={featured.title[l] || featured.title.en}
            size={200}
          />
          <span className="featured-copy">
            <span className="eyebrow">
              {tagOf(featured, games!) === "new"
                ? t("NEW GAME")
                : t("FEATURED")}
            </span>
            <strong>{featured.title[l] || featured.title.en}</strong>
            <span>{featured.description[l] || featured.description.en}</span>
            <span className="button">{t("Play")}</span>
          </span>
        </Link>
      )}

      {started.length > 0 && (
        <section className="continue-row" aria-labelledby="continue-heading">
          <h2 id="continue-heading">{t("Continue playing")}</h2>
          <div className="continue-games">
            {started.map((g) => (
              <Link key={g.id} href={href(playPath(g.id))}>
                <GameCover
                  game={g}
                  title={g.title[l] || g.title.en}
                  size={44}
                />
                <span>
                  <strong>{g.title[l] || g.title.en}</strong>
                  <ProgressLine progress={progress[g.id]} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {games && games.length > 0 && (
        <section aria-labelledby="all-heading">
          <div className="grid-head">
            <h2 id="all-heading">
              {t(`All ${info.label.toLowerCase()} games`)}
            </h2>
            {games.length > 1 && (
              <div
                className="sort-tabs"
                role="group"
                aria-label={t("Sort games")}
              >
                {SORTS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={sort === value}
                    onClick={() => setSort(value)}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="game-grid">
            {sortGames(games, sort, l).map((g) => (
              <GameCard
                key={g.id}
                game={g}
                tag={tagOf(g, games)}
                progress={progress[g.id]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** A home page category card's top games, as small thumbnails. */
export function TopGames({
  games,
  category,
}: {
  games: CatalogGame[] | null;
  category: Category;
}) {
  const { locale, href } = useLocale();
  const l = lang(locale);
  const top = games ? gamesIn(games, category, l).slice(0, 3) : [];
  if (!top.length) return null;
  return (
    <ul className="arena-games">
      {top.map((g) => {
        const title = g.title[l] || g.title.en;
        return (
          <li key={g.id}>
            <Link href={href(playPath(g.id))} title={title}>
              <GameCover game={g} title={title} size={36} />
              <span>{title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
