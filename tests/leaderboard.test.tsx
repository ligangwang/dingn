import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Leaderboard } from "../src/components/xp";

const mocks = vi.hoisted(() => ({
  session: { isAdmin: false, stats: null },
  board: { shown: false, entries: [{ name: "Ada", xp: 120, level: 3 }] },
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

it("links each name to the player's row on the Players page for admins", async () => {
  mocks.session.isAdmin = true;
  mocks.board.entries = [
    { name: "Ada", xp: 120, level: 3, uid: "u1" },
    { name: "Bo", xp: 80, level: 2 },
  ] as typeof mocks.board.entries;
  render(<Leaderboard />);
  const link = await screen.findByRole("link", { name: "Ada" });
  expect(link.getAttribute("href")).toBe("/admin/players/?uid=u1");
  // Without an id (everyone but admins), a name is plain text.
  expect(screen.queryByRole("link", { name: "Bo" })).toBeNull();
  expect(screen.getByText("Bo")).toBeTruthy();
});
