// The game catalog: every listed game with an approved live version, from
// GET /api/games (scripts/game-registry.mjs). Each game names its category in
// its game.json, so a newly approved game shows up on its category's page,
// in the menu and on the home page without a website change.
import type { BadgeDef } from "./rewards";

export const CATEGORIES = ["casual", "memory", "puzzle"] as const;
export type Category = (typeof CATEGORIES)[number];

export type CatalogGame = {
  id: string;
  version: string;
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  category: Category;
  /** The cover picture from the game's files, or null for drawn art. */
  cover: string | null;
  /** When the game joined the catalog (ISO time), or null. */
  addedAt: string | null;
  /** When an admin pinned it to its category's banner, or null. */
  featuredAt?: string | null;
  plays: { week: number; month: number };
  badges: BadgeDef[];
};

/** A game counts as new for this long after it joins the catalog. */
export const NEW_DAYS = 30;
/** Plays in the last week a game needs before it can be Hot. */
export const HOT_PLAYS = 20;

let loading: Promise<CatalogGame[]> | null = null;

/** The catalog, fetched once per page load. Empty when it can't be read. */
export function loadCatalog(): Promise<CatalogGame[]> {
  loading ??= fetch("/api/games", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { games: [] }))
    .then((body: { games?: CatalogGame[] }) =>
      (body.games ?? []).map((g) => ({
        ...g,
        category: (CATEGORIES as readonly string[]).includes(g.category)
          ? g.category
          : "casual",
        plays: g.plays ?? { week: 0, month: 0 },
        badges: g.badges ?? [],
      })),
    )
    .catch(() => {
      loading = null;
      return [];
    });
  return loading;
}
/** For tests: forget the fetched catalog. */
export const resetCatalog = () => void (loading = null);

export type Sort = "popular" | "new" | "az";

const time = (g: CatalogGame) => (g.addedAt ? Date.parse(g.addedAt) : 0);

/** Games in the order a sort tab shows them. */
export function sortGames(
  games: CatalogGame[],
  sort: Sort,
  lang: "en" | "zh",
): CatalogGame[] {
  const byTitle = (a: CatalogGame, b: CatalogGame) =>
    (a.title[lang] || a.title.en).localeCompare(
      b.title[lang] || b.title.en,
      lang === "zh" ? "zh-CN" : "en",
    );
  const order = {
    popular: (a: CatalogGame, b: CatalogGame) =>
      b.plays.month - a.plays.month ||
      b.plays.week - a.plays.week ||
      byTitle(a, b),
    new: (a: CatalogGame, b: CatalogGame) => time(b) - time(a) || byTitle(a, b),
    az: byTitle,
  }[sort];
  return [...games].sort(order);
}

/** The games of one category, most played first. */
export const gamesIn = (
  games: CatalogGame[],
  category: Category,
  lang: "en" | "zh" = "en",
) =>
  sortGames(
    games.filter((g) => g.category === category),
    "popular",
    lang,
  );

/**
 * A card's tag: "new" for a game that joined in the last NEW_DAYS days,
 * otherwise "hot" for the category's most played game this week.
 */
export function tagOf(
  game: CatalogGame,
  games: CatalogGame[],
  now = Date.now(),
): "new" | "hot" | null {
  if (game.addedAt && now - time(game) < NEW_DAYS * 86_400_000) return "new";
  if (game.plays.week < HOT_PLAYS) return null;
  const top = games
    .filter((g) => g.category === game.category)
    .reduce((best, g) => (g.plays.week > best.plays.week ? g : best), game);
  return top.id === game.id ? "hot" : null;
}

/** The game an admin pinned to a category's banner, if any. */
export const pinnedGame = (games: CatalogGame[]) =>
  games
    .filter((g) => g.featuredAt)
    .sort((a, b) => b.featuredAt!.localeCompare(a.featuredAt!))[0] ?? null;

/**
 * The banner game: the one an admin pinned, otherwise the newest game of the
 * last NEW_DAYS days, otherwise the most played.
 */
export function featuredGame(
  games: CatalogGame[],
  now = Date.now(),
): CatalogGame | null {
  if (!games.length) return null;
  const pinned = pinnedGame(games);
  if (pinned) return pinned;
  const newest = sortGames(games, "new", "en")[0];
  if (newest.addedAt && now - time(newest) < NEW_DAYS * 86_400_000)
    return newest;
  return sortGames(games, "popular", "en")[0];
}

/** What a signed-in player has done in one game. */
export type GameProgress = {
  badges: number;
  /** The level from the game's saved progress, when it saves one. */
  level: number | null;
  /** The last time they earned a badge in it (ISO), for ordering. */
  lastAt: string | null;
};

/**
 * Per game, what the player has done: their badges (from their wallet) and
 * the games with saved progress on their account (`game_progress_<id>`).
 */
export function playerProgress(
  wallet: { badges: { game: string; at: string }[] } | null,
  account: Record<string, unknown> | null,
): Record<string, GameProgress> {
  const result: Record<string, GameProgress> = {};
  const entry = (id: string) =>
    (result[id] ??= { badges: 0, level: null, lastAt: null });
  for (const badge of wallet?.badges ?? []) {
    const p = entry(badge.game);
    p.badges++;
    if (!p.lastAt || badge.at > p.lastAt) p.lastAt = badge.at;
  }
  for (const [field, value] of Object.entries(account ?? {})) {
    const match = /^game_progress_([a-z][a-z0-9]{1,30})$/.exec(field);
    if (!match || typeof value !== "string") continue;
    let level: unknown = null;
    try {
      level = (JSON.parse(value) as { level?: unknown } | null)?.level;
    } catch {}
    entry(match[1]).level =
      Number.isInteger(level) && (level as number) > 0
        ? (level as number)
        : null;
  }
  return result;
}
