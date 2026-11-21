import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Leaderboard } from "../src/components/xp";
import type { LeaderboardEntry } from "../src/lib/xp";

const mocks = vi.hoisted(() => ({
  session: { isAdmin: false, stats: null },
  board: {
    shown: false,
    entries: [{ name: "Ada", xp: 120, level: 3 }] as LeaderboardEntry[],
  },
}));
vi.mock("../src/components/session", () => ({
  useSession: () => mocks.session,
}));
vi.mock("../src/lib/xp", async (real) => ({
  ...(await real<object>()),
  fetchLeaderboard: async () => mocks.board,
}));

afterEach(cleanup);

it("hides the leaderboard from players until an admin makes it public", async () => {
  const { container } = render(<Leaderboard />);
  await new Promise((r) => setTimeout(r, 0));
  expect(container.innerHTML).toBe("");
  cleanup();

  mocks.session.isAdmin = true;
  render(<Leaderboard />);
  expect(await screen.findByText("Ada")).toBeTruthy();
  expect(screen.getByText(/Only admins see this/)).toBeTruthy();
  cleanup();

  mocks.session.isAdmin = false;
  mocks.board.shown = true;
  render(<Leaderboard />);
  expect(await screen.findByText("Ada")).toBeTruthy();
  expect(screen.queryByText(/Only admins see this/)).toBeNull();
});

it("links each name to the player's public page, and admins also to the Players page", async () => {
  mocks.session.isAdmin = true;
  mocks.board.entries = [
    {
      name: "Ada",
      xp: 120,
      level: 3,
      uid: "u1",
      number: "7302518846",
      avatar: "fox",
    },
    { name: "Bo", xp: 80, level: 2 },
  ];
  render(<Leaderboard />);
  const link = await screen.findByRole("link", { name: "Ada" });
  expect(link.getAttribute("href")).toMatch(/^\/player\/7302518846\/?$/);
  expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe(
    "/admin/players/?uid=u1",
  );
  // Each avatar wears the player's level, with their honor's title beside it.
  const row = link.closest("li")!;
  expect(
    row.querySelector(".profile-avatar.honor-bronze .profile-medal"),
  ).toBeTruthy();
  expect(row.querySelector(".lv")!.textContent).toBe("Camp leader");
  // A player with no public number yet is plain text.
  expect(screen.queryByRole("link", { name: "Bo" })).toBeNull();
  expect(screen.getByText("Bo")).toBeTruthy();
  cleanup();

  // Everyone else gets the public page only, never an account id.
  mocks.session.isAdmin = false;
  mocks.board.shown = true;
  mocks.board.entries = [
    { name: "Ada", xp: 120, level: 3, number: "7302518846" },
  ];
  render(<Leaderboard />);
  expect(
    (await screen.findByRole("link", { name: "Ada" })).getAttribute("href"),
  ).toMatch(/^\/player\/7302518846\/?$/);
  expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
});
