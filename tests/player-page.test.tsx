import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { numberFromPath, PlayerPage } from "../src/components/player-page";

const mocks = vi.hoisted(() => ({
  fetchPlayer: vi.fn(),
  session: { stats: null as null | { number: string } },
}));
vi.mock("../src/lib/xp", async (real) => ({
  ...(await real<typeof import("../src/lib/xp")>()),
  fetchPlayer: mocks.fetchPlayer,
}));
vi.mock("../src/components/session", () => ({
  useOptionalSession: () => mocks.session,
  useSession: () => mocks.session,
}));
// No WebGL in tests: the kingdom shows as a list of its buildings.
vi.mock("../src/components/kingdom-scene", () => ({
  KingdomScene: class {},
  webglAvailable: () => false,
}));
vi.mock("../src/components/rewards", () => ({
  titleOf: (title: { en: string }) => title.en,
  useGameTitles: () => (id: string) => ({ gemsurge: "Gem Surge" })[id] ?? id,
}));

const ada = {
  number: "7302518846",
  name: "Star Gazer",
  avatar: "fox",
  level: 12,
  xp: 7000,
  floor: 6600,
  next: 7800,
  streak: 4,
  badges: [
    {
      game: "gemsurge",
      id: "l1",
      tier: "bronze",
      level: 1,
      title: { en: "First light", zh: "" },
    },
  ],
  kingdom: {
    stage: "city",
    size: 8,
    hall: "village",
    tiles: { "2,0": "well", "-2,0": "windmill" },
  },
};

beforeEach(() => {
  window.history.replaceState(null, "", "/player/7302518846/");
  mocks.session.stats = null;
});
afterEach(cleanup);

it("reads the public number from the address, in any language", () => {
  expect(numberFromPath("/player/7302518846/")).toBe("7302518846");
  expect(numberFromPath("/zh/player/7302518846")).toBe("7302518846");
  expect(numberFromPath("/player/0302518846/")).toBeNull();
  expect(numberFromPath("/player/abc/")).toBeNull();
});

it("shows a player's honor, level, kingdom and badges to anyone", async () => {
  mocks.fetchPlayer.mockResolvedValue(ada);
  render(<PlayerPage />);
  expect(
    await screen.findByRole("heading", { level: 1, name: "Star Gazer" }),
  ).toBeTruthy();
  expect(mocks.fetchPlayer).toHaveBeenCalledWith("7302518846");
  expect(document.querySelector(".profile-honor")!.textContent).toBe(
    "City governor",
  );
  expect(document.querySelector(".profile-avatar.honor-gold")).toBeTruthy();
  expect(screen.getByText("City")).toBeTruthy();
  const badges = screen.getByRole("region", { name: /Badges/ });
  expect(within(badges).getByText("First light")).toBeTruthy();
  expect(within(badges).getByText("Gem Surge")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Path of honor" })).toBeTruthy();
  // Their kingdom as they built it, to look around.
  const kingdom = screen.getByRole("region", { name: "Kingdom · City" });
  expect(await within(kingdom).findByText("Windmill")).toBeTruthy();
  expect(within(kingdom).getByText("Well")).toBeTruthy();
  expect(
    within(kingdom).getByText(
      "Choose Look around, then drag to turn and pinch or scroll to zoom.",
    ),
  ).toBeTruthy();
  // Nothing private, and no editing for a visitor.
  expect(screen.queryByText(/coins/i)).toBeNull();
  expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();
  // The title is set by an effect after the page shows, so wait for it.
  await waitFor(() => expect(document.title).toBe("Star Gazer · dingn"));
});

it("tells the player when the page is their own", async () => {
  mocks.session.stats = { number: "7302518846" };
  mocks.fetchPlayer.mockResolvedValue(ada);
  render(<PlayerPage />);
  const link = await screen.findByRole("link", {
    name: "Edit profile",
  });
  expect(link.getAttribute("href")).toMatch(/^\/account\/?#settings$/);
});

it("says so when no player has the number", async () => {
  const { XpError } = await import("../src/lib/xp");
  mocks.fetchPlayer.mockRejectedValue(
    new XpError("No player has that number.", "no_player"),
  );
  render(<PlayerPage />);
  expect(await screen.findByText("Player not found")).toBeTruthy();
  expect(screen.getByText("No player has that number.")).toBeTruthy();
});

it("says when a player has no kingdom yet", async () => {
  mocks.fetchPlayer.mockResolvedValue({ ...ada, level: 1, kingdom: null });
  render(<PlayerPage />);
  expect(
    await screen.findByText("Star Gazer hasn’t founded a kingdom yet."),
  ).toBeTruthy();
});
