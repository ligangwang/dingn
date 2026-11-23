// The challenge card dingn shows on the Challenges page, the home page and
// beside a game: one implementation.
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChallengeCard } from "../src/components/challenge-card";
import type { CatalogGame } from "../src/lib/catalog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const game = {
  id: "gemsurge",
  title: { en: "Gem Surge", zh: "Gem Surge" },
  category: "casual",
} as unknown as CatalogGame;
const challenge = {
  game: "gemsurge",
  id: "5bGIRR-9qERD",
  mode: "level",
  score: 2110,
  unit: "points" as const,
  name: "Ada",
  players: 3,
  top: { name: "Ada", score: 2940 },
  results: [
    { name: "Ada", score: 2940, number: "1234567890" },
    { name: "Bo", score: 2900, number: "2345678901" },
    { name: null, score: 100 },
  ],
  createdAt: "2026-11-22T23:41:09.270Z",
};

it("shows the challenge, its results in order and each player's page", () => {
  render(<ChallengeCard challenge={challenge} game={game} />);
  expect(
    screen
      .getByRole("link", {
        name: "Ada reached 2,110 points in Gem Surge. Can you beat it?",
      })
      .getAttribute("href"),
  ).toMatch(/^\/play\/gemsurge\/?\?c=5bGIRR-9qERD$/);
  // The title is the only way in: there is no separate button.
  expect(screen.queryByRole("link", { name: "Take the challenge" })).toBeNull();
  expect(screen.getByText("Players: 3")).toBeTruthy();
  const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(rows).toEqual([
    "1Ada2,940 points",
    "2Bo2,900 points",
    "3A player100 points",
  ]);
  expect(
    screen.getByRole("link", { name: "Ada" }).getAttribute("href"),
  ).toMatch(/^\/player\/1234567890\/?$/);
  expect(screen.getByRole("link", { name: "Bo" }).getAttribute("href")).toMatch(
    /^\/player\/2345678901\/?$/,
  );
  // A player dingn has no number for is named without a link.
  expect(screen.queryByRole("link", { name: "A player" })).toBeNull();
});

it("copies the challenge's link, and offers Share only where the browser can", async () => {
  const writeText = vi.fn(async () => {});
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  render(<ChallengeCard challenge={challenge} game={game} />);
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(writeText).toHaveBeenCalledWith(
    `${location.origin}/play/gemsurge/?c=5bGIRR-9qERD`,
  );
  expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
  cleanup();

  const share = vi.fn(async () => {});
  vi.stubGlobal("navigator", { ...navigator, share });
  render(<ChallengeCard challenge={challenge} game={game} />);
  await userEvent.click(await screen.findByRole("button", { name: "Share" }));
  expect(share).toHaveBeenCalledWith({
    url: `${location.origin}/play/gemsurge/?c=5bGIRR-9qERD`,
  });
});

it("is the home page's heading when it is the latest challenge", () => {
  render(<ChallengeCard challenge={challenge} game={game} hero />);
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Ada reached 2,110 points in Gem Surge. Can you beat it?",
    }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", {
        name: "Ada reached 2,110 points in Gem Surge. Can you beat it?",
      })
      .getAttribute("href"),
  ).toMatch(/^\/play\/gemsurge\/?\?c=5bGIRR-9qERD$/);
  expect(screen.getByRole("link", { name: "Ada" })).toBeTruthy();
});
