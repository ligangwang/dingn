import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "../src/components/header";
import { CategoryPage } from "../src/components/catalog";
import { resetCatalog } from "../src/lib/catalog";

const mocks = vi.hoisted(() => ({
  path: "/casual/",
  session: {
    user: null as null | { uid: string },
    ready: true,
    isAdmin: false,
    profile: {},
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
  useOptionalSession: () => mocks.session,
}));
vi.mock("../src/components/xp", () => ({
  LevelBadge: () => null,
  Leaderboard: () => null,
}));
vi.mock("../src/lib/database", () => ({
  database: {},
  doc: () => ({}),
  getDoc: async () => ({
    data: () => ({ game_progress_crowdrush: '{"level":4}' }),
  }),
}));
vi.mock("../src/lib/api", () => ({
  api: async () => ({
    coins: 0,
    items: [],
    badges: [{ game: "crowdrush", at: "2026-11-01" }],
  }),
}));

const game = (id: string, category: string, extra = {}) => ({
  id,
  version: "1.0.0",
  title: { en: id.toUpperCase(), zh: id },
  description: { en: `About ${id}`, zh: id },
  category,
  cover: null,
  addedAt: "2026-01-01T00:00:00Z",
  plays: { week: 0, month: 0 },
  badges: [],
  ...extra,
});

beforeEach(() => {
  resetCatalog();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        games: [
          game("crowdrush", "casual", { plays: { week: 40, month: 200 } }),
          game("pawpal", "casual", { plays: { week: 2, month: 9 } }),
          game("rubikscube", "puzzle"),
        ],
      }),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.session.user = null;
});

it("each menu category opens its page and lists its games", async () => {
  mocks.path = "/play/pawpal/";
  render(<Header />);
  const casual = screen.getByRole("link", { name: "Casual" });
  expect(casual.getAttribute("href")).toBe("/casual");
  expect(
    ["Memory", "Puzzle", "Adventure", "Kingdom"].map((name) =>
      screen.getByRole("link", { name }).getAttribute("href"),
    ),
  ).toEqual(["/memory", "/puzzle", "/adventure", "/kingdom"]);
  // On a game's page, its category is the current one.
  await screen.findByText("PAWPAL");
  expect(casual.getAttribute("aria-current")).toBe("page");
  const menu = casual.parentElement!.querySelector("ul")!;
  expect(
    within(menu)
      .getAllByRole("link", { hidden: true })
      .map((a) => a.textContent),
  ).toEqual(["CROWDRUSH", "PAWPAL", "All casual games →"]);
  // Memory has no games yet, so it has no list.
  expect(
    screen
      .getByRole("link", { name: "Memory" })
      .parentElement!.querySelector("ul"),
  ).toBeNull();
});

it("a category page shows a banner, sorting, tags and the player's progress", async () => {
  mocks.session.user = { uid: "u1" };
  render(<CategoryPage category="casual" />);
  expect(screen.getByRole("heading", { name: "Casual games" })).toBeTruthy();
  await screen.findByText("2 games");
  expect(screen.getByText("Continue playing")).toBeTruthy();
  const grid = document.querySelector(".game-grid")!;
  const titles = () =>
    [...grid.querySelectorAll(".game-card strong")].map((s) => s.textContent);
  expect(titles()).toEqual(["CROWDRUSH", "PAWPAL"]);
  expect(within(grid as HTMLElement).getByText("Hot")).toBeTruthy();
  expect(
    (await within(grid as HTMLElement).findAllByText("Level 4 · 1 badge"))
      .length,
  ).toBe(1);
  await userEvent.setup().click(screen.getByRole("button", { name: "A–Z" }));
  expect(titles()).toEqual(["CROWDRUSH", "PAWPAL"]);
  expect(grid.querySelector(".game-card")!.getAttribute("href")).toBe(
    "/play/crowdrush",
  );
});

it("a category with no games says new ones appear once approved", async () => {
  render(<CategoryPage category="memory" />);
  expect(await screen.findByText(/No games here yet/)).toBeTruthy();
});

it("the home page features the game an admin picked for it", async () => {
  mocks.path = "/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        games: [
          game("crowdrush", "casual", { plays: { week: 40, month: 200 } }),
          game("rubikscube", "puzzle", { homeAt: "2026-11-20T00:00:00Z" }),
        ],
      }),
    })),
  );
  const { Home } = await import("../src/components/home");
  render(<Home />);
  const banner = await screen.findByRole("region", { name: "FEATURED" });
  expect(
    within(banner).getByText("RUBIKSCUBE", { selector: "strong" }),
  ).toBeTruthy();
  expect(within(banner).getByText("About rubikscube")).toBeTruthy();
  expect(within(banner).getByRole("link").getAttribute("href")).toMatch(
    /^\/play\/rubikscube\/?$/,
  );
});

it("a game's clip lies over its cover in a banner and on its card", async () => {
  mocks.path = "/casual/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        games: [
          game("crowdrush", "casual", {
            cover: "/g/crowdrush/1.0.0/cover.jpg",
            clip: "/g/crowdrush/1.0.0/play.mp4",
            plays: { week: 40, month: 200 },
          }),
          game("pawpal", "casual", { cover: "/g/pawpal/1.0.0/cover.jpg" }),
        ],
      }),
    })),
  );
  const { container } = render(<CategoryPage category="casual" />);
  await screen.findAllByText("CROWDRUSH");
  const clips = [...container.querySelectorAll("video.cover-clip")];
  // The banner and the card of the game with a clip; none for the other.
  expect(clips.map((v) => v.getAttribute("src"))).toEqual([
    "/g/crowdrush/1.0.0/play.mp4",
    "/g/crowdrush/1.0.0/play.mp4",
  ]);
  for (const clip of clips) {
    // Silent, not downloaded until it plays, and hidden until it is playing.
    expect((clip as HTMLVideoElement).muted).toBe(true);
    expect(clip.getAttribute("preload")).toBe("none");
    expect(clip.className).toBe("cover-clip");
    expect(clip.closest(".game-cover")!.querySelector("img")).toBeTruthy();
    // A cover that plays a clip is marked, so a banner's slow zoom stays off.
    expect(clip.closest(".game-cover")!.className).toBe("game-cover has-clip");
  }
  // A cover with no clip keeps the plain class, and with it the zoom.
  const plain = [...container.querySelectorAll(".game-cover")].filter(
    (c) => !c.querySelector("video"),
  );
  expect(plain.length).toBeGreaterThan(0);
  for (const cover of plain) expect(cover.className).toBe("game-cover");
});
