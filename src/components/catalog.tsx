"use client";
// The category pages (/casual/, /memory/, /puzzle/, /adventure/), the menu's game lists
// and the home page's thumbnails, all filled from the catalog
// (src/lib/catalog.ts): whatever games are listed and approved.
import { pick } from "@/lib/i18n";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useLocale } from "./locale";
import { useOptionalSession } from "./session";
import { useWallet } from "./rewards";
import { AdventureIcon, CrowdIcon, MemoryIcon, PuzzleIcon } from "./icons";
import { ServerFill } from "./server-fill";
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
  adventure: {
    label: "Adventure",
    path: "/adventure/",
    Icon: AdventureIcon,
    tagline: "Explore new worlds and collect what you find.",
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

/** A small whole number from a game id, to vary the drawn covers. */
function hue(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/**
 * A game's clip, played silently over its cover: in a banner while
 * the banner is on screen ("view"), on a card while the pointer or the
 * keyboard is on it ("hover"). It is not downloaded until it first plays,
 * and never plays for someone who asked for less motion or less data.
 */
function CoverClip({ src, when }: { src: string; when: "view" | "hover" }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      (navigator as { connection?: { saveData?: boolean } }).connection
        ?.saveData;
    if (still) return;
    const play = () => {
      try {
        // A browser may refuse to play; the cover just stays.
        video.play()?.catch(() => {});
      } catch {}
    };
    const stop = () => {
      video.pause();
      setShowing(false);
    };
    if (when === "view") {
      if (typeof IntersectionObserver === "undefined") return;
      const seen = new IntersectionObserver(
        ([entry]) => (entry.isIntersecting ? play() : stop()),
        { threshold: 0.6 },
      );
      seen.observe(video);
      return () => seen.disconnect();
    }
    // The whole card is the link, so the clip follows the card.
    const card = video.closest("a") ?? video.parentElement;
    if (!card) return;
    const rewind = () => {
      stop();
      video.currentTime = 0;
    };
    card.addEventListener("pointerenter", play);
    card.addEventListener("pointerleave", rewind);
    card.addEventListener("focus", play);
    card.addEventListener("blur", rewind);
    return () => {
      card.removeEventListener("pointerenter", play);
      card.removeEventListener("pointerleave", rewind);
      card.removeEventListener("focus", play);
      card.removeEventListener("blur", rewind);
    };
  }, [when, src]);
  return (
    <video
      ref={ref}
      className={showing ? "cover-clip showing" : "cover-clip"}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setShowing(true)}
    />
  );
}

/**
 * The game's cover picture, or drawn art in the category's style. With
 * `play`, a game that has a clip plays it over the cover.
 */
export function GameCover({
  game,
  title,
  size = 120,
  play,
}: {
  game: CatalogGame;
  title: string;
  size?: number;
  play?: "view" | "hover";
}) {
  const { Icon } = CATEGORY_INFO[game.category];
  if (game.cover) {
    const clip = play && game.clip;
    return (
      // With a clip, the cover holds still (catalog.css): the clip moves.
      <span className={clip ? "game-cover has-clip" : "game-cover"}>
        <img src={game.cover} alt="" loading="lazy" />
        {play && clip && <CoverClip src={clip} when={play} />}
      </span>
    );
  }
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
  const l = locale;
  const title = pick(game.title, l);
  return (
    <Link className="game-card" href={href(playPath(game.id))}>
      <GameCover game={game} title={title} play="hover" />
      {tag && (
        <span className={`game-tag tag-${tag}`}>
          {tag === "new" ? t("New") : t("Hot")}
        </span>
      )}
      <span className="game-card-body">
        <strong>{title}</strong>
        <span className="game-pitch">{pick(game.description, l)}</span>
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
  const l = locale;
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

      {!games && (
        <>
          {/* The server lists the games here until the catalog loads. */}
          <ServerFill name="games" className="game-grid server-games" />
          <p className="category-loading">{t("Loading games…")}</p>
        </>
      )}

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
            title={pick(featured.title, l)}
            size={200}
            play="view"
          />
          <span className="featured-copy">
            <span className="eyebrow">
              {tagOf(featured, games!) === "new"
                ? t("NEW GAME")
                : t("FEATURED")}
            </span>
            <strong>{pick(featured.title, l)}</strong>
            <span>{pick(featured.description, l)}</span>
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
                <GameCover game={g} title={pick(g.title, l)} size={44} />
                <span>
                  <strong>{pick(g.title, l)}</strong>
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
  const l = locale;
  // Until the catalog loads, the server's list of the top games.
  if (!games)
    return (
      <ServerFill as="ul" name={`top-${category}`} className="arena-games" />
    );
  const top = gamesIn(games, category, l).slice(0, 3);
  if (!top.length) return null;
  return (
    <ul className="arena-games">
      {top.map((g) => {
        const title = pick(g.title, l);
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
