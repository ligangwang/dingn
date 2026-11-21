import { test } from "node:test";
import assert from "node:assert/strict";
import {
  featuredGame,
  homeGame,
  gamesIn,
  playerProgress,
  sortGames,
  tagOf,
  type CatalogGame,
} from "../src/lib/catalog";

const NOW = Date.parse("2026-11-15T00:00:00Z");
const game = (id: string, extra: Partial<CatalogGame> = {}): CatalogGame => ({
  id,
  version: "1.0.0",
  title: { en: id, zh: id },
  description: { en: "", zh: "" },
  category: "casual",
  cover: null,
  addedAt: "2026-01-01T00:00:00Z",
  plays: { week: 0, month: 0 },
  badges: [],
  ...extra,
});

const crowd = game("crowdrush", { plays: { week: 50, month: 300 } });
const pet = game("pawpal", {
  addedAt: "2026-11-10T00:00:00Z",
  plays: { week: 5, month: 5 },
});
const gems = game("gemsurge", { plays: { week: 30, month: 100 } });
const cube = game("rubikscube", {
  category: "puzzle",
  plays: { week: 90, month: 400 },
});
const all = [pet, cube, gems, crowd];

test("a category's games, sorted by the Popular, New and A-Z tabs", () => {
  assert.deepEqual(
    gamesIn(all, "casual").map((g) => g.id),
    ["crowdrush", "gemsurge", "pawpal"],
  );
  const casual = gamesIn(all, "casual");
  assert.deepEqual(
    sortGames(casual, "new", "en").map((g) => g.id),
    ["pawpal", "crowdrush", "gemsurge"],
  );
  assert.deepEqual(
    sortGames(casual, "az", "en").map((g) => g.id),
    ["crowdrush", "gemsurge", "pawpal"],
  );
});

test("New for a month after joining, Hot for the category's most played", () => {
  assert.equal(tagOf(pet, all, NOW), "new");
  assert.equal(tagOf(crowd, all, NOW), "hot");
  assert.equal(tagOf(gems, all, NOW), null);
  // Each category has its own Hot game, and a quiet week has none.
  assert.equal(tagOf(cube, all, NOW), "hot");
  const quiet = game("quiet", { plays: { week: 3, month: 3 } });
  assert.equal(tagOf(quiet, [quiet], NOW), null);
});

test("the banner shows the newest game, otherwise the most played", () => {
  assert.equal(featuredGame(gamesIn(all, "casual"), NOW)?.id, "pawpal");
  assert.equal(featuredGame([crowd, gems], NOW)?.id, "crowdrush");
  assert.equal(featuredGame([], NOW), null);
  // A game an admin pinned wins over both.
  const pinned = { ...gems, featuredAt: "2026-11-14T00:00:00Z" };
  assert.equal(featuredGame([crowd, pet, pinned], NOW)?.id, "gemsurge");
});

test("the home page features the game an admin picked, from any category", () => {
  // With no pick, it chooses as a banner does, over every game.
  assert.equal(homeGame(all, NOW)?.id, featuredGame(all, NOW)?.id);
  assert.equal(homeGame([], NOW), null);
  const picked = { ...cube, homeAt: "2026-11-14T00:00:00Z" };
  assert.equal(homeGame([crowd, pet, picked], NOW)?.id, "rubikscube");
  // A category banner's pin does not decide the home page.
  const banner = { ...gems, featuredAt: "2026-11-15T00:00:00Z" };
  assert.equal(homeGame([crowd, banner, picked], NOW)?.id, "rubikscube");
});

test("a player's progress comes from their badges and saved games", () => {
  const progress = playerProgress(
    {
      badges: [
        { game: "crowdrush", at: "2026-11-01" },
        { game: "crowdrush", at: "2026-11-03" },
        { game: "rubikscube", at: "2026-10-01" },
      ],
    },
    {
      game_progress_crowdrush: JSON.stringify({ level: 7, best: 6 }),
      game_progress_pawpal: JSON.stringify({ home: "{}" }),
      game_progress_memory: "not json",
      userName: "Mia",
    },
  );
  assert.deepEqual(progress, {
    crowdrush: { badges: 2, level: 7, lastAt: "2026-11-03" },
    rubikscube: { badges: 1, level: null, lastAt: "2026-10-01" },
    pawpal: { badges: 0, level: null, lastAt: null },
    memory: { badges: 0, level: null, lastAt: null },
  });
  assert.deepEqual(playerProgress(null, null), {});
});
