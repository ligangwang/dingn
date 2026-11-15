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
